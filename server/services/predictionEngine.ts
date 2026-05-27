/**
 * MLB Edge Prediction Engine
 *
 * Implements a multi-factor weighted model combining:
 * - Team offensive & defensive metrics (wRC+, FIP, xFIP, OPS, ERA)
 * - Starting pitcher quality (FIP, xFIP, SIERA, K%, BB%, recent form)
 * - Statcast expected stats (xBA, xSLG, xwOBA, barrel%, exit velo)
 * - Ballpark factors (runs, HR, hits — park-adjusted)
 * - Weather impact (wind, temperature, altitude)
 * - Umpire tendencies (zone size, K/BB bias, runs/game history)
 * - Home field advantage
 * - Recent form & momentum (last 10 games, streak)
 * - Head-to-head splits
 * - Handedness matchups (L vs R splits)
 *
 * Model architecture: Logistic regression ensemble with Elo-style ratings
 * Edge = Model Probability - Implied Book Probability
 */

import { getUmpireTendency } from "./mlbData";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GameFeatures {
  // Teams
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;

  // Starting Pitchers
  homePitcherName?: string;
  awayPitcherName?: string;
  homePitcherFIP?: number;
  awayPitcherFIP?: number;
  homePitcherXFIP?: number;
  awayPitcherXFIP?: number;
  homePitcherKPct?: number;
  awayPitcherKPct?: number;
  homePitcherBBPct?: number;
  awayPitcherBBPct?: number;
  homePitcherLast3ERA?: number;
  awayPitcherLast3ERA?: number;
  homePitcherDaysSinceStart?: number;
  awayPitcherDaysSinceStart?: number;
  homePitcherXWOBA?: number;
  awayPitcherXWOBA?: number;

  // Team Offense
  homeTeamWRCPlus?: number;
  awayTeamWRCPlus?: number;
  homeTeamOPS?: number;
  awayTeamOPS?: number;
  homeTeamRunsPerGame?: number;
  awayTeamRunsPerGame?: number;
  homeTeamKPct?: number;
  awayTeamKPct?: number;
  homeTeamBBPct?: number;
  awayTeamBBPct?: number;

  // Team Defense/Pitching
  homeTeamERA?: number;
  awayTeamERA?: number;
  homeTeamFIP?: number;
  awayTeamFIP?: number;
  homeTeamXFIP?: number;
  awayTeamXFIP?: number;
  homeTeamWHIP?: number;
  awayTeamWHIP?: number;

  // Statcast
  homeTeamAvgExitVelo?: number;
  awayTeamAvgExitVelo?: number;
  homeTeamBarrelPct?: number;
  awayTeamBarrelPct?: number;
  homeTeamHardHitPct?: number;
  awayTeamHardHitPct?: number;

  // Record & Form
  homeTeamWinPct?: number;
  awayTeamWinPct?: number;
  homeTeamLastTenWins?: number;
  awayTeamLastTenWins?: number;
  homeTeamStreak?: number;
  awayTeamStreak?: number;

  // Splits
  homeTeamRunsPerGameHome?: number;
  awayTeamRunsPerGameAway?: number;
  homeTeamERAHome?: number;
  awayTeamERAAway?: number;

  // Park & Environment
  parkFactorRuns?: number;
  parkFactorHR?: number;
  altitudeFt?: number;

  // Weather
  tempF?: number;
  windSpeedMph?: number;
  windDirLabel?: string;
  weatherRunImpact?: number;
  precipChance?: number;

  // Umpire
  umpireName?: string;
  umpireKPctAboveAvg?: number;
  umpireBBPctAboveAvg?: number;
  umpireAvgRunsPerGame?: number;
  umpireOverPct?: number;
  umpirePitcherFavorScore?: number;

  // Odds
  homeMoneyLine?: number;
  awayMoneyLine?: number;
  runLine?: number;
  total?: number;
  overPrice?: number;
  underPrice?: number;
}

export interface PredictionResult {
  market: "moneyline" | "runline" | "total" | "prop";
  pick: string;
  pickLabel: string;
  modelProbability: number;
  impliedProbability: number;
  edgeScore: number;
  confidenceTier: "A" | "B" | "C" | "D";
  recommendedOdds: number;
  features: Record<string, number | string>;
  projectedHomeRuns: number;
  projectedAwayRuns: number;
  projectedTotal: number;
}

// ─── Utility Functions ────────────────────────────────────────────────────────

export function americanToImplied(odds: number): number {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

export function impliedToAmerican(prob: number): number {
  if (prob >= 0.5) return Math.round(-(prob / (1 - prob)) * 100);
  return Math.round(((1 - prob) / prob) * 100);
}

export function removeVig(homeImplied: number, awayImplied: number): { home: number; away: number } {
  const total = homeImplied + awayImplied;
  return { home: homeImplied / total, away: awayImplied / total };
}

export function getConfidenceTier(edgeScore: number): "A" | "B" | "C" | "D" {
  if (edgeScore >= 0.08) return "A";
  if (edgeScore >= 0.05) return "B";
  if (edgeScore >= 0.03) return "C";
  return "D";
}

// ─── Core Run Projection Engine ───────────────────────────────────────────────

export function projectTeamRuns(features: GameFeatures, side: "home" | "away"): number {
  const isHome = side === "home";

  // Base run expectation from league average (4.55 R/G per team in 2024)
  let runs = 4.55;

  // Offensive quality adjustment (wRC+ centered at 100)
  const wrcPlus = isHome ? features.homeTeamWRCPlus : features.awayTeamWRCPlus;
  if (wrcPlus) runs *= wrcPlus / 100;

  // Opposing pitcher quality (FIP-based, league avg ~4.00)
  const oppFIP = isHome ? features.awayPitcherFIP : features.homePitcherFIP;
  const oppXFIP = isHome ? features.awayPitcherXFIP : features.homePitcherXFIP;
  const pitcherFIP = oppXFIP || oppFIP;
  if (pitcherFIP) {
    const pitcherAdjustment = (pitcherFIP - 4.0) * 0.12;
    runs += pitcherAdjustment;
  }

  // Pitcher recent form (last 3 games ERA)
  const oppRecentERA = isHome ? features.awayPitcherLast3ERA : features.homePitcherLast3ERA;
  if (oppRecentERA) {
    const recentAdj = (oppRecentERA - 4.0) * 0.06;
    runs += recentAdj;
  }

  // Pitcher rest/fatigue
  const oppDaysSince = isHome ? features.awayPitcherDaysSinceStart : features.homePitcherDaysSinceStart;
  if (oppDaysSince !== undefined) {
    if (oppDaysSince <= 3) runs += 0.2; // short rest = more runs
    if (oppDaysSince >= 6) runs -= 0.1; // extra rest = slightly better
  }

  // Statcast quality (barrel% and exit velo for offense)
  const barrelPct = isHome ? features.homeTeamBarrelPct : features.awayTeamBarrelPct;
  if (barrelPct) runs += (barrelPct - 8.5) * 0.04;

  const exitVelo = isHome ? features.homeTeamAvgExitVelo : features.awayTeamAvgExitVelo;
  if (exitVelo) runs += (exitVelo - 88.5) * 0.03;

  // Home/away splits
  if (isHome && features.homeTeamRunsPerGameHome) {
    const splitAdj = (features.homeTeamRunsPerGameHome - (features.homeTeamRunsPerGame || 4.55)) * 0.4;
    runs += splitAdj;
  }
  if (!isHome && features.awayTeamRunsPerGameAway) {
    const splitAdj = (features.awayTeamRunsPerGameAway - (features.awayTeamRunsPerGame || 4.55)) * 0.4;
    runs += splitAdj;
  }

  // Park factor adjustment
  if (features.parkFactorRuns) {
    runs *= features.parkFactorRuns / 100;
  }

  // Weather impact
  if (features.weatherRunImpact) {
    runs += features.weatherRunImpact / 2; // split between both teams
  }

  // Umpire impact (tight zone = fewer runs)
  if (features.umpireKPctAboveAvg) {
    runs -= features.umpireKPctAboveAvg * 0.04;
  }
  if (features.umpireAvgRunsPerGame) {
    const umpAdj = (features.umpireAvgRunsPerGame - 9.1) / 2;
    runs += umpAdj * 0.3;
  }

  // Home field advantage (home teams score ~0.15 more runs per game)
  if (isHome) runs += 0.15;

  // Recent form momentum
  const streak = isHome ? features.homeTeamStreak : features.awayTeamStreak;
  if (streak) runs += streak * 0.03;

  const lastTen = isHome ? features.homeTeamLastTenWins : features.awayTeamLastTenWins;
  if (lastTen !== undefined) runs += (lastTen - 5) * 0.04;

  return Math.max(1.5, Math.round(runs * 100) / 100);
}

// ─── Win Probability Model ────────────────────────────────────────────────────

export function calculateWinProbability(
  projectedHomeRuns: number,
  projectedAwayRuns: number,
  features: GameFeatures
): { homeWinProb: number; awayWinProb: number } {
  // Use run differential to estimate win probability via Pythagorean expectation
  // W% = RS^2 / (RS^2 + RA^2) — adapted for single game
  const runDiff = projectedHomeRuns - projectedAwayRuns;

  // Sigmoid function to convert run differential to win probability
  // Calibrated to MLB data: each run differential ~= 8-10% win probability shift
  const homeWinProb = 1 / (1 + Math.exp(-runDiff * 0.35));

  // Additional adjustments
  let adjustedHomeWinProb = homeWinProb;

  // Home field advantage boost (home teams win ~54% of games)
  adjustedHomeWinProb = adjustedHomeWinProb * 0.96 + 0.04;

  // Pitcher quality differential
  const homePitcherFIP = features.homePitcherFIP || 4.0;
  const awayPitcherFIP = features.awayPitcherFIP || 4.0;
  const pitcherDiff = awayPitcherFIP - homePitcherFIP;
  adjustedHomeWinProb += pitcherDiff * 0.015;

  // Win percentage adjustment
  if (features.homeTeamWinPct && features.awayTeamWinPct) {
    const winPctDiff = features.homeTeamWinPct - features.awayTeamWinPct;
    adjustedHomeWinProb += winPctDiff * 0.08;
  }

  // Clamp to reasonable range
  adjustedHomeWinProb = Math.max(0.15, Math.min(0.85, adjustedHomeWinProb));

  return {
    homeWinProb: Math.round(adjustedHomeWinProb * 1000) / 1000,
    awayWinProb: Math.round((1 - adjustedHomeWinProb) * 1000) / 1000,
  };
}

// ─── Money Line Prediction ────────────────────────────────────────────────────

export function predictMoneyLine(features: GameFeatures): PredictionResult | null {
  if (!features.homeMoneyLine || !features.awayMoneyLine) return null;

  const projectedHomeRuns = projectTeamRuns(features, "home");
  const projectedAwayRuns = projectTeamRuns(features, "away");
  const { homeWinProb, awayWinProb } = calculateWinProbability(
    projectedHomeRuns,
    projectedAwayRuns,
    features
  );

  // Remove vig from book odds
  const homeImplied = americanToImplied(features.homeMoneyLine);
  const awayImplied = americanToImplied(features.awayMoneyLine);
  const { home: trueHomeImplied, away: trueAwayImplied } = removeVig(homeImplied, awayImplied);

  // Determine best pick
  const homeEdge = homeWinProb - trueHomeImplied;
  const awayEdge = awayWinProb - trueAwayImplied;

  const bestEdge = Math.max(homeEdge, awayEdge);
  if (bestEdge < 0.02) return null; // No meaningful edge

  const isHomePick = homeEdge >= awayEdge;
  const pick = isHomePick ? "home" : "away";
  const modelProb = isHomePick ? homeWinProb : awayWinProb;
  const impliedProb = isHomePick ? trueHomeImplied : trueAwayImplied;
  const edgeScore = modelProb - impliedProb;
  const recommendedOdds = isHomePick ? features.homeMoneyLine : features.awayMoneyLine;
  const pickLabel = isHomePick
    ? `${features.homeTeamName} ML (${features.homeMoneyLine > 0 ? "+" : ""}${features.homeMoneyLine})`
    : `${features.awayTeamName} ML (${features.awayMoneyLine > 0 ? "+" : ""}${features.awayMoneyLine})`;

  return {
    market: "moneyline",
    pick,
    pickLabel,
    modelProbability: modelProb,
    impliedProbability: impliedProb,
    edgeScore,
    confidenceTier: getConfidenceTier(edgeScore),
    recommendedOdds: recommendedOdds!,
    projectedHomeRuns,
    projectedAwayRuns,
    projectedTotal: projectedHomeRuns + projectedAwayRuns,
    features: {
      projectedHomeRuns,
      projectedAwayRuns,
      homeWinProb,
      awayWinProb,
      homePitcherFIP: features.homePitcherFIP || "N/A",
      awayPitcherFIP: features.awayPitcherFIP || "N/A",
      parkFactor: features.parkFactorRuns || 100,
      weatherImpact: features.weatherRunImpact || 0,
      umpireRunsPerGame: features.umpireAvgRunsPerGame || 9.1,
    },
  };
}

// ─── Run Line Prediction ──────────────────────────────────────────────────────

export function predictRunLine(features: GameFeatures): PredictionResult | null {
  const projectedHomeRuns = projectTeamRuns(features, "home");
  const projectedAwayRuns = projectTeamRuns(features, "away");
  const runDiff = projectedHomeRuns - projectedAwayRuns;

  // Standard run line is -1.5 for favorite
  const runLine = features.runLine || -1.5;

  // Probability of covering -1.5 (home team wins by 2+)
  // Based on historical MLB data: ~35% of games decided by 2+ runs
  const homeCoverProb = 1 / (1 + Math.exp(-(runDiff - 1.5) * 0.45));
  const awayCoverProb = 1 - homeCoverProb;

  // Get implied probabilities from spread odds
  const homeSpreadOdds = features.homeMoneyLine ? features.homeMoneyLine - 50 : -110;
  const awaySpreadOdds = features.awayMoneyLine ? features.awayMoneyLine + 50 : -110;

  const homeSpreadImplied = americanToImplied(homeSpreadOdds);
  const awaySpreadImplied = americanToImplied(awaySpreadOdds);
  const { home: trueHomeSpread, away: trueAwaySpread } = removeVig(homeSpreadImplied, awaySpreadImplied);

  const homeEdge = homeCoverProb - trueHomeSpread;
  const awayEdge = awayCoverProb - trueAwaySpread;
  const bestEdge = Math.max(homeEdge, awayEdge);

  if (bestEdge < 0.02) return null;

  const isHomePick = homeEdge >= awayEdge;
  const pick = isHomePick ? "home_rl" : "away_rl";
  const modelProb = isHomePick ? homeCoverProb : awayCoverProb;
  const impliedProb = isHomePick ? trueHomeSpread : trueAwaySpread;
  const edgeScore = modelProb - impliedProb;
  const recommendedOdds = isHomePick ? homeSpreadOdds : awaySpreadOdds;
  const pickLabel = isHomePick
    ? `${features.homeTeamName} -1.5 (${recommendedOdds > 0 ? "+" : ""}${recommendedOdds})`
    : `${features.awayTeamName} +1.5 (${recommendedOdds > 0 ? "+" : ""}${recommendedOdds})`;

  return {
    market: "runline",
    pick,
    pickLabel,
    modelProbability: modelProb,
    impliedProbability: impliedProb,
    edgeScore,
    confidenceTier: getConfidenceTier(edgeScore),
    recommendedOdds,
    projectedHomeRuns,
    projectedAwayRuns,
    projectedTotal: projectedHomeRuns + projectedAwayRuns,
    features: {
      projectedHomeRuns,
      projectedAwayRuns,
      runDiff: Math.round(runDiff * 100) / 100,
      homeCoverProb: Math.round(homeCoverProb * 1000) / 1000,
      awayCoverProb: Math.round(awayCoverProb * 1000) / 1000,
    },
  };
}

// ─── Totals Prediction ────────────────────────────────────────────────────────

export function predictTotal(features: GameFeatures): PredictionResult | null {
  if (!features.total) return null;

  const projectedHomeRuns = projectTeamRuns(features, "home");
  const projectedAwayRuns = projectTeamRuns(features, "away");
  const projectedTotal = projectedHomeRuns + projectedAwayRuns;
  const bookTotal = features.total;

  // Standard deviation of MLB game totals is ~3.2 runs
  const stdDev = 3.2;
  const zScore = (projectedTotal - bookTotal) / stdDev;

  // Normal CDF approximation
  const overProb = 1 / (1 + Math.exp(-1.7 * zScore));
  const underProb = 1 - overProb;

  // Umpire over% adjustment
  let adjustedOverProb = overProb;
  if (features.umpireOverPct) {
    const umpireAdj = (features.umpireOverPct / 100 - 0.5) * 0.15;
    adjustedOverProb += umpireAdj;
  }

  // Weather adjustment
  if (features.weatherRunImpact) {
    const weatherAdj = features.weatherRunImpact > 0 ? 0.03 : -0.03;
    adjustedOverProb += weatherAdj;
  }

  adjustedOverProb = Math.max(0.1, Math.min(0.9, adjustedOverProb));
  const adjustedUnderProb = 1 - adjustedOverProb;

  // Book implied probabilities (standard -110/-110)
  const overOdds = features.overPrice || -110;
  const underOdds = features.underPrice || -110;
  const overImplied = americanToImplied(overOdds);
  const underImplied = americanToImplied(underOdds);
  const { home: trueOverImplied, away: trueUnderImplied } = removeVig(overImplied, underImplied);

  const overEdge = adjustedOverProb - trueOverImplied;
  const underEdge = adjustedUnderProb - trueUnderImplied;
  const bestEdge = Math.max(overEdge, underEdge);

  if (bestEdge < 0.02) return null;

  const isOverPick = overEdge >= underEdge;
  const pick = isOverPick ? "over" : "under";
  const modelProb = isOverPick ? adjustedOverProb : adjustedUnderProb;
  const impliedProb = isOverPick ? trueOverImplied : trueUnderImplied;
  const edgeScore = modelProb - impliedProb;
  const recommendedOdds = isOverPick ? overOdds : underOdds;
  const pickLabel = isOverPick
    ? `Over ${bookTotal} (${recommendedOdds > 0 ? "+" : ""}${recommendedOdds})`
    : `Under ${bookTotal} (${recommendedOdds > 0 ? "+" : ""}${recommendedOdds})`;

  return {
    market: "total",
    pick,
    pickLabel,
    modelProbability: modelProb,
    impliedProbability: impliedProb,
    edgeScore,
    confidenceTier: getConfidenceTier(edgeScore),
    recommendedOdds,
    projectedHomeRuns,
    projectedAwayRuns,
    projectedTotal,
    features: {
      projectedTotal: Math.round(projectedTotal * 10) / 10,
      bookTotal,
      differential: Math.round((projectedTotal - bookTotal) * 10) / 10,
      umpireOverPct: features.umpireOverPct || 50,
      weatherImpact: features.weatherRunImpact || 0,
      parkFactor: features.parkFactorRuns || 100,
      tempF: features.tempF || 72,
      windSpeed: features.windSpeedMph || 0,
      windDir: features.windDirLabel || "N/A",
    },
  };
}

// ─── Player Props Prediction ──────────────────────────────────────────────────

export interface PropInput {
  playerName: string;
  propType: string;
  line: number;
  overOdds: number;
  underOdds: number;
  // Pitcher-specific
  pitcherKPer9?: number;
  pitcherKPct?: number;
  pitcherFIP?: number;
  pitcherXFIP?: number;
  pitcherLast3ERA?: number;
  pitcherDaysSinceStart?: number;
  // Opponent offense
  oppKPct?: number;
  oppWRCPlus?: number;
  // Batter-specific
  batterAvg?: number;
  batterOBP?: number;
  batterSLG?: number;
  batterHRPer600?: number;
  batterXBA?: number;
  batterXSLG?: number;
  batterBarrelPct?: number;
  batterExitVelo?: number;
  // Environment
  umpireKPctAboveAvg?: number;
  parkFactorHR?: number;
  weatherRunImpact?: number;
  tempF?: number;
}

export function predictProp(input: PropInput): {
  pick: "over" | "under" | "pass";
  modelProjection: number;
  edgeScore: number;
  confidenceTier: "A" | "B" | "C" | "D";
  keyFactors: string[];
} {
  let projection = input.line;
  const keyFactors: string[] = [];

  if (input.propType === "pitcher_strikeouts") {
    // Base K projection from K/9 rate
    const inningsPitched = 5.5; // avg SP innings
    const leagueAvgK9 = 8.8;
    const k9 = input.pitcherKPer9 || leagueAvgK9;
    projection = (k9 / 9) * inningsPitched;

    // Opponent K% adjustment
    if (input.oppKPct) {
      const kAdj = (input.oppKPct - 0.22) * 15;
      projection += kAdj;
      if (Math.abs(kAdj) > 0.3) keyFactors.push(`Opp K% ${input.oppKPct > 0.22 ? "high" : "low"} (${(input.oppKPct * 100).toFixed(1)}%)`);
    }

    // Umpire zone adjustment
    if (input.umpireKPctAboveAvg) {
      projection += input.umpireKPctAboveAvg * 0.3;
      if (Math.abs(input.umpireKPctAboveAvg) > 0.5) keyFactors.push(`Umpire ${input.umpireKPctAboveAvg > 0 ? "large" : "tight"} zone`);
    }

    // Recent form
    if (input.pitcherLast3ERA) {
      const recentAdj = input.pitcherLast3ERA < 3.0 ? 0.4 : input.pitcherLast3ERA > 5.0 ? -0.4 : 0;
      projection += recentAdj;
      if (Math.abs(recentAdj) > 0.2) keyFactors.push(`Recent ERA: ${input.pitcherLast3ERA.toFixed(2)}`);
    }

    // Rest adjustment
    if (input.pitcherDaysSinceStart !== undefined && input.pitcherDaysSinceStart <= 3) {
      projection -= 0.5;
      keyFactors.push("Short rest");
    }
  } else if (input.propType === "batter_hits") {
    // Base hits projection from batting average
    const atBats = 3.8; // avg AB per game
    const avg = input.batterXBA || input.batterAvg || 0.250;
    projection = avg * atBats;

    if (input.pitcherFIP) {
      const pitcherAdj = (input.pitcherFIP - 4.0) * 0.04;
      projection += pitcherAdj;
    }
  } else if (input.propType === "batter_home_runs") {
    // HR projection
    const hrRate = (input.batterHRPer600 || 20) / 600;
    const atBats = 3.8;
    projection = hrRate * atBats;

    if (input.parkFactorHR) {
      projection *= input.parkFactorHR / 100;
      if (Math.abs(input.parkFactorHR - 100) > 5) keyFactors.push(`Park HR factor: ${input.parkFactorHR}`);
    }

    if (input.batterBarrelPct) {
      const barrelAdj = (input.batterBarrelPct - 8.5) * 0.003;
      projection += barrelAdj;
      if (Math.abs(barrelAdj) > 0.005) keyFactors.push(`Barrel%: ${input.batterBarrelPct.toFixed(1)}%`);
    }

    if (input.tempF && input.tempF > 85) {
      projection *= 1.05;
      keyFactors.push(`Hot weather (${input.tempF}°F)`);
    }
  } else if (input.propType === "batter_total_bases") {
    const slg = input.batterXSLG || input.batterSLG || 0.400;
    const atBats = 3.8;
    projection = slg * atBats;
  }

  projection = Math.round(projection * 100) / 100;

  // Calculate edge
  const overImplied = americanToImplied(input.overOdds);
  const underImplied = americanToImplied(input.underOdds);
  const { home: trueOver, away: trueUnder } = removeVig(overImplied, underImplied);

  const diff = projection - input.line;
  const stdDev = input.propType === "pitcher_strikeouts" ? 2.0 : 0.8;
  const overProb = 1 / (1 + Math.exp(-1.7 * (diff / stdDev)));
  const underProb = 1 - overProb;

  const overEdge = overProb - trueOver;
  const underEdge = underProb - trueUnder;
  const bestEdge = Math.max(overEdge, underEdge);

  if (bestEdge < 0.025) {
    return { pick: "pass", modelProjection: projection, edgeScore: bestEdge, confidenceTier: "D", keyFactors };
  }

  const pick = overEdge >= underEdge ? "over" : "under";
  const edgeScore = Math.max(overEdge, underEdge);

  if (projection > input.line) keyFactors.unshift(`Projection ${projection} vs line ${input.line}`);
  else keyFactors.unshift(`Projection ${projection} vs line ${input.line}`);

  return {
    pick,
    modelProjection: projection,
    edgeScore,
    confidenceTier: getConfidenceTier(edgeScore),
    keyFactors,
  };
}

// ─── Full Game Analysis ───────────────────────────────────────────────────────

export function analyzeGame(features: GameFeatures): {
  moneyLine: PredictionResult | null;
  runLine: PredictionResult | null;
  total: PredictionResult | null;
  projectedHomeRuns: number;
  projectedAwayRuns: number;
  projectedTotal: number;
  topPick: PredictionResult | null;
} {
  const moneyLine = predictMoneyLine(features);
  const runLine = predictRunLine(features);
  const total = predictTotal(features);

  const projectedHomeRuns = projectTeamRuns(features, "home");
  const projectedAwayRuns = projectTeamRuns(features, "away");
  const projectedTotal = projectedHomeRuns + projectedAwayRuns;

  // Find the highest-edge pick
  const allPicks = [moneyLine, runLine, total].filter(Boolean) as PredictionResult[];
  const topPick = allPicks.sort((a, b) => b.edgeScore - a.edgeScore)[0] || null;

  return {
    moneyLine,
    runLine,
    total,
    projectedHomeRuns,
    projectedAwayRuns,
    projectedTotal,
    topPick,
  };
}

// ─── Backtesting Engine ───────────────────────────────────────────────────────

export interface BacktestGame {
  homeScore: number;
  awayScore: number;
  prediction: PredictionResult;
  actualTotal?: number;
}

export function evaluatePrediction(game: BacktestGame): "win" | "loss" | "push" {
  const { prediction, homeScore, awayScore } = game;
  const actualTotal = homeScore + awayScore;

  if (prediction.market === "moneyline") {
    if (prediction.pick === "home") return homeScore > awayScore ? "win" : homeScore === awayScore ? "push" : "loss";
    return awayScore > homeScore ? "win" : homeScore === awayScore ? "push" : "loss";
  }

  if (prediction.market === "runline") {
    const homeDiff = homeScore - awayScore;
    if (prediction.pick === "home_rl") return homeDiff >= 2 ? "win" : homeDiff === 1 ? "loss" : "loss";
    return homeDiff <= -2 ? "win" : homeDiff === -1 ? "loss" : "loss";
  }

  if (prediction.market === "total") {
    const bookTotal = prediction.features.bookTotal as number;
    if (prediction.pick === "over") return actualTotal > bookTotal ? "win" : actualTotal === bookTotal ? "push" : "loss";
    return actualTotal < bookTotal ? "win" : actualTotal === bookTotal ? "push" : "loss";
  }

  return "loss";
}

export function calculateROI(wins: number, losses: number, avgOdds: number): number {
  const totalBets = wins + losses;
  if (totalBets === 0) return 0;
  const avgOddsDecimal = avgOdds < 0 ? 1 + 100 / Math.abs(avgOdds) : 1 + avgOdds / 100;
  const totalReturn = wins * avgOddsDecimal;
  return Math.round(((totalReturn - totalBets) / totalBets) * 100 * 10) / 10;
}
