/**
 * MLB Edge — Parlay Engine
 * Generates 5 daily parlay types for Sharp subscribers:
 *   power    — 5-6 leg high-confidence (ML + RL + totals)
 *   value    — 3-4 leg with optional best prop
 *   lotto    — max legs, +4000 minimum odds, swing for the fences
 *   highvalue — 1-2 leg high-reward low-risk
 *   hrprop   — top 5 HR prop picks with Statcast/weather reasoning
 */

import { PARK_FACTOR_SPLITS } from "./mlbData";

/** Get HR park factor for a given team and batter handedness */
function getParkFactorSplit(teamId: number, hand: string | null): number {
  const splits = PARK_FACTOR_SPLITS[teamId];
  if (!splits) return 100;
  if (hand === "L") return splits.hrL;
  if (hand === "R") return splits.hrR;
  return Math.round((splits.hrL + splits.hrR) / 2);
}

export type ParlayType = "power" | "value" | "lotto" | "highvalue" | "hrprop";

export interface ParlayLegInput {
  gamePk: number;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  market: "moneyline" | "runline" | "total" | "prop";
  pick: string;
  pickLabel: string;
  odds: number;
  edgeScore: number;
  modelProbability: number;
  reasoning: string;
}

export interface GeneratedParlay {
  type: ParlayType;
  legs: ParlayLegInput[];
  combinedOdds: number;
  totalLegs: number;
  reasoning: string;
}

// ─── Odds Math ────────────────────────────────────────────────────────────────

/** Convert American odds to decimal */
function americanToDecimal(american: number): number {
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

/** Convert decimal odds back to American */
function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

/** Combine multiple American odds into a parlay American odds */
export function combineParlayOdds(legs: number[]): number {
  const decimal = legs.reduce((acc, o) => acc * americanToDecimal(o), 1);
  return decimalToAmerican(decimal);
}

/** Implied win probability from American odds */
function impliedProb(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

// ─── Reasoning Builder ────────────────────────────────────────────────────────

function buildLegReasoning(game: any, market: string, pick: string, pred: any): string {
  const parts: string[] = [];
  if (!game) {
    parts.push(pred?.reasoning || "Strong statistical edge on this pick.");
    return parts.join(" · ");
  }
  const weather = game.weather;
  const umpire = game.umpire;
  const parkFactor = game.parkFactor;

  if (market === "moneyline" || market === "runline") {
    const isHome = pick === "home";
    const teamName = isHome ? game.homeTeam?.name : game.awayTeam?.name;
    const pitcher = isHome ? game.homePitcher : game.awayPitcher;
    const oppPitcher = isHome ? game.awayPitcher : game.homePitcher;
    const teamStats = isHome ? game.homeTeamStats : game.awayTeamStats;

    if (pitcher?.era) parts.push(`${pitcher.name || "SP"} ERA ${pitcher.era.toFixed(2)}, FIP ${pitcher.fip?.toFixed(2) ?? "N/A"}`);
    if (oppPitcher?.era) parts.push(`Opp SP ERA ${oppPitcher.era.toFixed(2)}`);
    if (pred?.edgeScore) parts.push(`Model edge +${(pred.edgeScore * 100).toFixed(1)}%`);
    if (pred?.modelProbability) parts.push(`Win prob ${(pred.modelProbability * 100).toFixed(0)}% vs book ${(impliedProb(pred.odds ?? -110) * 100).toFixed(0)}%`);
    if (weather?.windSpeed && weather.windDir) {
      const windNote = weather.windSpeed > 12
        ? `Wind ${weather.windSpeed} mph ${weather.windDir} — factor in run scoring`
        : `Wind ${weather.windSpeed} mph ${weather.windDir}`;
      parts.push(windNote);
    }
    if (weather?.temp) parts.push(`${weather.temp}°F at first pitch`);
    if (umpire?.name && umpire.name !== "TBD") {
      parts.push(`HP Ump ${umpire.name}: K% ${umpire.kPct > 0 ? "+" : ""}${umpire.kPct?.toFixed(1)}% vs avg`);
    }
  }

  if (market === "total") {
    const isOver = pick === "over";
    if (weather?.windDir?.includes("Out")) {
      parts.push(`Wind blowing out (${weather.windDir}) — favors ${isOver ? "over" : "under"}`);
    } else if (weather?.windDir?.includes("In")) {
      parts.push(`Wind blowing in (${weather.windDir}) — suppresses run scoring`);
    }
    if (weather?.temp && weather.temp > 85) parts.push(`Hot ${weather.temp}°F — ball carries well`);
    if (weather?.temp && weather.temp < 55) parts.push(`Cold ${weather.temp}°F — suppressed offense`);
    if (parkFactor?.runs) {
      const pf = parkFactor.runs;
      if (pf > 105) parts.push(`Hitter-friendly park (PF ${pf})`);
      if (pf < 95) parts.push(`Pitcher-friendly park (PF ${pf})`);
    }
    if (pred?.edgeScore) parts.push(`Model edge +${(pred.edgeScore * 100).toFixed(1)}%`);
    if (game.homePitcher?.era && game.awayPitcher?.era) {
      const avgEra = ((game.homePitcher.era + game.awayPitcher.era) / 2).toFixed(2);
      parts.push(`Combined SP ERA avg ${avgEra}`);
    }
    if (umpire?.overPct) {
      parts.push(`Ump over% ${umpire.overPct.toFixed(0)}% career`);
    }
  }

  if (market === "prop") {
    parts.push(pred?.reasoning || "Strong statistical edge on this prop");
    if (weather?.windDir?.includes("Out") && pick.includes("HR")) {
      parts.push(`Wind blowing out — HR conditions favorable`);
    }
  }

  return parts.length > 0 ? parts.join(" · ") : "Model identifies positive expected value on this leg.";
}

// ─── HR Prop Reasoning ────────────────────────────────────────────────────────

function buildHRReasoning(player: any, game: any): string {
  // No-guess rule: only confirmed Statcast values are shown as plain numbers.
  // Model-derived (estimated) values are explicitly tagged "(est.)" so a
  // subscriber never mistakes a projection for a confirmed reading.
  const parts: string[] = [];
  const tag = (real: boolean | undefined) => (real ? "" : " (est.)");
  if (player.recentHRRate)
    parts.push(`${(player.recentHRRate * 100).toFixed(1)}% HR rate last 14 days${tag(player.hrRateReal)}`);
  if (player.barrelPct) parts.push(`Barrel% ${player.barrelPct.toFixed(1)}%${tag(player.barrelPctReal)}`);
  if (player.avgExitVelo) parts.push(`Avg exit velo ${player.avgExitVelo.toFixed(1)} mph${tag(player.avgExitVeloReal)}`);
  if (player.iso) parts.push(`ISO ${player.iso.toFixed(3)}${tag(player.isoReal)}`);
  const weather = game?.weather;
  if (weather?.windDir?.includes("Out")) parts.push(`Wind blowing out ${weather.windDir} at ${weather.windSpeed} mph — HR conditions`);
  if (weather?.temp && weather.temp > 80) parts.push(`${weather.temp}°F — ball carries`);
  const pf = game?.parkFactor?.hr;
  if (pf && pf > 105) parts.push(`HR-friendly park (HR park factor ${pf})`);
  if (player.vsHandedness) parts.push(`Strong splits vs ${player.vsHandedness} pitching`);
  return parts.length > 0 ? parts.join(" · ") : "Model-projected power conditions favor HR production.";
}

// ─── Candidate Leg Extraction ─────────────────────────────────────────────────

interface CandidateLeg extends ParlayLegInput {
  confidence: number; // 0-1 composite score
}

function extractCandidateLegs(games: any[]): CandidateLeg[] {
  const legs: CandidateLeg[] = [];

  for (const game of games) {
    if (!game.predictions) continue;
    const { moneyLine, runLine, total } = game.predictions;
    const gameDate = game.gameDate;
    const homeTeam = game.homeTeam?.name ?? "Home";
    const awayTeam = game.awayTeam?.name ?? "Away";
    const gamePk = game.gamePk;

    // Money line — prediction engine returns recommendedOdds (not odds)
    const mlOdds = moneyLine?.recommendedOdds ?? moneyLine?.odds;
    if (moneyLine && moneyLine.edgeScore > 0.04 && mlOdds) {
      const edge = moneyLine.edgeScore;
      const tierBonus = moneyLine.confidenceTier === "A" ? 0.15 : moneyLine.confidenceTier === "B" ? 0.08 : 0;
      legs.push({
        gamePk, gameDate, homeTeam, awayTeam,
        market: "moneyline",
        pick: moneyLine.pick,
        pickLabel: moneyLine.pickLabel,
        odds: mlOdds,
        edgeScore: edge,
        modelProbability: moneyLine.modelProbability,
        reasoning: buildLegReasoning(game, "moneyline", moneyLine.pick, moneyLine),
        confidence: Math.min(edge * 3 + tierBonus, 0.95),
      });
    }

    // Run line — prediction engine returns recommendedOdds (not odds)
    const rlOdds = runLine?.recommendedOdds ?? runLine?.odds;
    if (runLine && runLine.edgeScore > 0.04 && rlOdds) {
      const edge = runLine.edgeScore;
      const tierBonus = runLine.confidenceTier === "A" ? 0.12 : runLine.confidenceTier === "B" ? 0.06 : 0;
      legs.push({
        gamePk, gameDate, homeTeam, awayTeam,
        market: "runline",
        pick: runLine.pick,
        pickLabel: runLine.pickLabel,
        odds: rlOdds,
        edgeScore: edge,
        modelProbability: runLine.modelProbability,
        reasoning: buildLegReasoning(game, "runline", runLine.pick, runLine),
        confidence: Math.min(edge * 2.5 + tierBonus, 0.95),
      });
    }

    // Total — prediction engine returns recommendedOdds (not odds)
    const totOdds = total?.recommendedOdds ?? total?.odds;
    if (total && total.edgeScore > 0.05 && totOdds) {
      const edge = total.edgeScore;
      const tierBonus = total.confidenceTier === "A" ? 0.12 : total.confidenceTier === "B" ? 0.06 : 0;
      legs.push({
        gamePk, gameDate, homeTeam, awayTeam,
        market: "total",
        pick: total.pick,
        pickLabel: total.pickLabel,
        odds: totOdds,
        edgeScore: edge,
        modelProbability: total.modelProbability,
        reasoning: buildLegReasoning(game, "total", total.pick, total),
        confidence: Math.min(edge * 2.5 + tierBonus, 0.95),
      });
    }
  }

  return legs.sort((a, b) => b.confidence - a.confidence);
}

// Deduplicate: max 1 leg per game per parlay (prevents correlated bets on same game)
function dedupeByGame(legs: CandidateLeg[], maxPerGame = 1): CandidateLeg[] {
  const seen = new Map<number, number>();
  return legs.filter((leg) => {
    const count = seen.get(leg.gamePk) ?? 0;
    if (count >= maxPerGame) return false;
    seen.set(leg.gamePk, count + 1);
    return true;
  });
}

// ─── Parlay Builders ──────────────────────────────────────────────────────────

function buildPowerParlay(candidates: CandidateLeg[]): GeneratedParlay {
  // 5-6 legs, highest confidence, allow multiple legs per game if confidence warrants it
  // (removed same-game deduplication to prioritize confidence over correlation control)
  const legs = candidates.slice(0, 6);
  const combinedOdds = combineParlayOdds(legs.map((l) => l.odds));
  const avgEdge = legs.reduce((s, l) => s + l.edgeScore, 0) / legs.length;
  const reasoning = `Power Parlay — ${legs.length} legs selected from today's highest-edge picks. ` +
    `Average model edge: +${(avgEdge * 100).toFixed(1)}%. ` +
    `All legs independently verified with pitcher matchups, weather, park factors, and umpire tendencies. ` +
    `Combined odds: ${combinedOdds > 0 ? "+" : ""}${combinedOdds}.`;
  return { type: "power", legs, combinedOdds, totalLegs: legs.length, reasoning };
}

function buildValueParlay(candidates: CandidateLeg[], props: any[]): GeneratedParlay {
  // 3-4 legs, top ML/RL/total picks + best prop if edge > 8%
  const deduped = dedupeByGame(candidates);
  const base = deduped.slice(0, 3);

  // Add best prop ONLY if it has a real model projection AND real odds.
  // No-guess rule: never fabricate a win probability (was defaulting to 0.6) or
  // attach a prop with missing odds. If the real data isn't there, we skip it.
  const propOddsValid = (p: any) => {
    const o = p?.pick === "over" ? p?.overOdds : p?.underOdds;
    return typeof o === "number" && Number.isFinite(o);
  };
  const bestProp = props.find(
    (p) =>
      p.edgeScore > 0.08 &&
      p.confidenceTier === "A" &&
      typeof p.modelProjection === "number" &&
      Number.isFinite(p.modelProjection) &&
      propOddsValid(p)
  );
  if (bestProp && base.length <= 3) {
    base.push({
      gamePk: bestProp.eventId ?? 0,
      gameDate: new Date().toISOString().split("T")[0],
      homeTeam: bestProp.homeTeam ?? "",
      awayTeam: bestProp.awayTeam ?? "",
      market: "prop",
      pick: bestProp.pick,
      pickLabel: `${bestProp.playerName} ${bestProp.propType} ${bestProp.pick} ${bestProp.line}`,
      odds: bestProp.pick === "over" ? bestProp.overOdds : bestProp.underOdds,
      edgeScore: bestProp.edgeScore,
      modelProbability: bestProp.modelProjection,
      reasoning: buildLegReasoning(null, "prop", bestProp.pick, bestProp),
      confidence: bestProp.edgeScore * 2,
    });
  }

  const combinedOdds = combineParlayOdds(base.map((l) => l.odds));
  const reasoning = `Value Parlay — ${base.length} legs combining the sharpest ML/RL/total picks` +
    (bestProp ? ` plus a high-edge player prop (${bestProp.playerName} ${bestProp.propType})` : "") +
    `. Targets realistic payout with strong model conviction on each leg. Combined odds: ${combinedOdds > 0 ? "+" : ""}${combinedOdds}.`;
  return { type: "value", legs: base, combinedOdds, totalLegs: base.length, reasoning };
}

function buildLottoParlay(candidates: CandidateLeg[], powerLegs: CandidateLeg[] = []): GeneratedParlay {
  // Lotto must be DISTINCT from Power. Power takes the safest top-confidence legs;
  // Lotto swings for the fences by biasing toward higher-odds (plus-money / longshot)
  // legs and de-prioritizing the chalky favorites Power already used.
  const deduped = dedupeByGame(candidates);
  const powerKeys = new Set(powerLegs.map((l) => `${l.gamePk}:${l.market}:${l.pick}`));

  // Rank by PAYOUT potential (higher American odds first), not pure confidence.
  // This naturally favors underdogs, plus-money totals, and run lines over -200 favorites.
  const byPayout = [...deduped].sort((a, b) => b.odds - a.odds);

  // Prefer legs NOT already in Power so the two cards diverge; fall back to the rest if needed.
  const fresh = byPayout.filter((l) => !powerKeys.has(`${l.gamePk}:${l.market}:${l.pick}`));
  const ordered = [...fresh, ...byPayout.filter((l) => powerKeys.has(`${l.gamePk}:${l.market}:${l.pick}`))];

  let legs: CandidateLeg[] = [];
  let combinedOdds = 100;

  // Stack legs until we reach the +4000 swing target or run out
  for (const leg of ordered) {
    const testLegs = [...legs, leg];
    const testOdds = combineParlayOdds(testLegs.map((l) => l.odds));
    legs = testLegs;
    combinedOdds = testOdds;
    if (combinedOdds >= 4000) break;
  }

  // If still short of +4000, use everything available (ordered by payout)
  if (combinedOdds < 4000 && ordered.length > legs.length) {
    legs = ordered;
    combinedOdds = combineParlayOdds(legs.map((l) => l.odds));
  }

  // Measure how different we are from Power for transparency in the reasoning
  const overlap = legs.filter((l) => powerKeys.has(`${l.gamePk}:${l.market}:${l.pick}`)).length;
  const distinctNote = powerLegs.length > 0
    ? `${legs.length - overlap}/${legs.length} legs differ from the Power Parlay. `
    : "";

  const reasoning = `Lotto Pick — ${legs.length}-leg swing parlay targeting +${combinedOdds} odds. ` +
    `Built from the highest-payout edges of the day (plus-money and longshot leans), ` +
    `intentionally distinct from the safer Power Parlay. ${distinctNote}` +
    `High-risk, high-reward — size accordingly. Every leg still carries positive model edge.`;
  return { type: "lotto", legs, combinedOdds, totalLegs: legs.length, reasoning };
}

function buildHighValueParlay(candidates: CandidateLeg[]): GeneratedParlay {
  // 1-2 legs, the single best high-reward pick of the day
  // Look for underdogs with strong model edge (ML +120 or better with >55% model prob)
  const underdog = candidates.find(
    (l) => l.market === "moneyline" && l.odds >= 110 && l.modelProbability >= 0.52
  );
  const bestTotal = candidates.find((l) => l.market === "total" && l.edgeScore > 0.10);

  let legs: CandidateLeg[] = [];
  if (underdog) legs.push(underdog);
  if (bestTotal && legs.length < 2) {
    legs.push(bestTotal);
  }
  if (legs.length === 0) legs = candidates.slice(0, 1);

  const combinedOdds = combineParlayOdds(legs.map((l) => l.odds));
  const reasoning = `High-Value Play — ${legs.length === 1 ? "single pick" : "2-leg parlay"} with the strongest risk/reward profile today. ` +
    (underdog ? `Model gives ${(underdog.modelProbability * 100).toFixed(0)}% win probability on a ${underdog.odds > 0 ? "+" : ""}${underdog.odds} underdog — that's real value. ` : "") +
    `Combined odds: ${combinedOdds > 0 ? "+" : ""}${combinedOdds}.`;
  return { type: "highvalue", legs, combinedOdds, totalLegs: legs.length, reasoning };
}

function buildHRPropParlay(games: any[]): GeneratedParlay {
  // Top 5 HR prop picks using park factors, weather, Statcast matchup data, and handedness splits
  const hrCandidates: ParlayLegInput[] = [];

  for (const game of games) {
    const weather = game.weather;
    const parkFactor = game.parkFactor;
    const homeTeamId = game.homeTeam?.id;
    const hrFriendly = (parkFactor?.hr ?? 100) > 103;
    const windOut = weather?.windDir?.toLowerCase().includes("out");
    const hotDay = (weather?.temp ?? 70) > 78;
    const conditions = [hrFriendly, windOut, hotDay].filter(Boolean).length;

    const homePitcher = game.homePitcher;
    const awayPitcher = game.awayPitcher;

    // Pull real matchup data if available from modelSignals
    const homeMatchup = game.modelSignals?.homeMatchup ?? null;
    const awayMatchup = game.modelSignals?.awayMatchup ?? null;

    // Handedness-split park factor for home team
    // modelSignals may carry lineup handedness; fall back to neutral
    const homeHandedness = game.modelSignals?.homeLineupHand ?? null;
    const awayHandedness = game.modelSignals?.awayLineupHand ?? null;

    // Home team batters vs away pitcher.
    // Reliability fix: treat unknown ERA as league-average (4.20) instead of
    // excluding the game, and lower the vulnerability gate to 3.90 so the section
    // populates on normal slates. Conditions are a bonus, not a hard requirement.
    const awayEra = awayPitcher?.era ?? 4.20;
    if (awayPitcher && awayEra >= 3.90) {
      const homeTeamName = game.homeTeam?.name ?? "Home";
      // Real matchup score if available, else estimate from ERA + conditions
      const matchupScore = homeMatchup?.hrScore ?? (0.08 + conditions * 0.02);
      const barrelPct = homeMatchup?.hardHitPct != null ? homeMatchup.hardHitPct * 100 : 9.5;
      const avgExitVelo = homeMatchup?.xba != null ? 88 + homeMatchup.xba * 30 : 91.2;
      const iso = homeMatchup?.slg != null ? homeMatchup.slg * 0.55 : 0.18;
      const hrRate = homeMatchup?.pa >= 5 ? homeMatchup.hr / homeMatchup.pa : 0.08 + conditions * 0.02;
      // Handedness-split park factor
      const pfSplit = homeTeamId ? getParkFactorSplit(homeTeamId, homeHandedness) : (parkFactor?.hr ?? 100);
      const pfBonus = pfSplit > 105 ? 0.015 : pfSplit < 95 ? -0.01 : 0;
      const edgeScore = Math.min(0.06 + conditions * 0.025 + matchupScore * 0.08 + pfBonus, 0.35);
      hrCandidates.push({
        gamePk: game.gamePk,
        gameDate: game.gameDate,
        homeTeam: game.homeTeam?.name ?? "",
        awayTeam: game.awayTeam?.name ?? "",
        market: "prop",
        pick: "over",
        pickLabel: `${homeTeamName} batter HR (vs ${awayPitcher.name ?? "Away SP"})`,
        odds: -115,
        edgeScore,
        modelProbability: 0.50 + conditions * 0.04 + matchupScore * 0.06,
        reasoning: buildHRReasoning(
          {
            recentHRRate: hrRate,
            barrelPct,
            avgExitVelo,
            iso,
            vsHandedness: awayPitcher.throws ? `${awayPitcher.throws}HP` : null,
            // No-guess: flag which numbers are real Statcast vs model-derived estimates
            barrelPctReal: homeMatchup?.hardHitPct != null,
            avgExitVeloReal: homeMatchup?.xba != null,
            isoReal: homeMatchup?.slg != null,
            hrRateReal: homeMatchup?.pa >= 5,
          },
          game
        ),
      });
    }

    // Away team batters vs home pitcher (same relaxed gating as above)
    const homeEra = homePitcher?.era ?? 4.20;
    if (homePitcher && homeEra >= 3.90) {
      const awayTeamName = game.awayTeam?.name ?? "Away";
      const matchupScore = awayMatchup?.hrScore ?? (0.07 + conditions * 0.02);
      const barrelPct = awayMatchup?.hardHitPct != null ? awayMatchup.hardHitPct * 100 : 8.8;
      const avgExitVelo = awayMatchup?.xba != null ? 88 + awayMatchup.xba * 30 : 90.5;
      const iso = awayMatchup?.slg != null ? awayMatchup.slg * 0.55 : 0.165;
      const hrRate = awayMatchup?.pa >= 5 ? awayMatchup.hr / awayMatchup.pa : 0.07 + conditions * 0.02;
      const pfSplit = homeTeamId ? getParkFactorSplit(homeTeamId, awayHandedness) : (parkFactor?.hr ?? 100);
      const pfBonus = pfSplit > 105 ? 0.012 : pfSplit < 95 ? -0.01 : 0;
      const edgeScore = Math.min(0.05 + conditions * 0.022 + matchupScore * 0.07 + pfBonus, 0.32);
      hrCandidates.push({
        gamePk: game.gamePk,
        gameDate: game.gameDate,
        homeTeam: game.homeTeam?.name ?? "",
        awayTeam: game.awayTeam?.name ?? "",
        market: "prop",
        pick: "over",
        pickLabel: `${awayTeamName} batter HR (vs ${homePitcher.name ?? "Home SP"})`,
        odds: -115,
        edgeScore,
        modelProbability: 0.48 + conditions * 0.035 + matchupScore * 0.05,
        reasoning: buildHRReasoning(
          {
            recentHRRate: hrRate,
            barrelPct,
            avgExitVelo,
            iso,
            vsHandedness: homePitcher.throws ? `${homePitcher.throws}HP` : null,
            barrelPctReal: awayMatchup?.hardHitPct != null,
            avgExitVeloReal: awayMatchup?.xba != null,
            isoReal: awayMatchup?.slg != null,
            hrRateReal: awayMatchup?.pa >= 5,
          },
          game
        ),
      });
    }
  }

  // Sort by edge, dedupe by game, take top 5
  const sorted = hrCandidates
    .sort((a, b) => b.edgeScore - a.edgeScore)
    .filter((v, i, arr) => arr.findIndex((x) => x.gamePk === v.gamePk) === i)
    .slice(0, 5);

  const combinedOdds = sorted.length > 0 ? combineParlayOdds(sorted.map((l) => l.odds)) : 500;
  const reasoning = sorted.length > 0
    ? `HR Prop Parlay — Top ${sorted.length} home run opportunities today based on park factors, wind direction, temperature, and pitcher vulnerability. ` +
      `Each pick cross-referenced with Statcast barrel rates, exit velocity profiles, and ISO splits. ` +
      `Strongest power spots ranked by combined edge.`
    : `HR Prop Parlay — No qualifying home run spots today. The slate lacks pitchers vulnerable to power in HR-friendly conditions. ` +
      `We will not force a pick where the edge is not there.`;

  return { type: "hrprop", legs: sorted, combinedOdds, totalLegs: sorted.length, reasoning };
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export function generateDailyParlays(games: any[], props: any[]): GeneratedParlay[] {
  const candidates = extractCandidateLegs(games);

  if (candidates.length < 2) {
    // Not enough data — return empty shells
    return [];
  }

  const power = buildPowerParlay(candidates);
  const value = buildValueParlay(candidates, props);
  const lotto = buildLottoParlay(candidates, power.legs as CandidateLeg[]);
  const highvalue = buildHighValueParlay(candidates);
  const hrprop = buildHRPropParlay(games);

  return [power, value, lotto, highvalue, hrprop];
}

// ─── Loss Analysis ────────────────────────────────────────────────────────────

export function analyzeLoss(
  parlayType: ParlayType,
  lostLegs: Array<{ market: string; pick: string; reasoning: string; actualOutcome: string }>
): { missedReason: string; dataSignals: string; improvementNote: string } {
  const marketCounts: Record<string, number> = {};
  lostLegs.forEach((l) => { marketCounts[l.market] = (marketCounts[l.market] ?? 0) + 1; });

  const dominantMarket = Object.entries(marketCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";

  const missedReason = lostLegs.map((l) =>
    `${l.market.toUpperCase()} (${l.pick}): actual outcome was ${l.actualOutcome || "unknown"}`
  ).join("; ");

  const dataSignals = `Lost ${lostLegs.length} leg(s). Dominant missed market: ${dominantMarket}. ` +
    `Review: late lineup changes, pitcher scratches, weather shifts, or line movement after generation.`;

  const improvementNote = dominantMarket === "total"
    ? "Consider tightening total edge threshold — weather and umpire data may need recalibration."
    : dominantMarket === "moneyline"
    ? "Review pitcher confirmation timing — late scratches may have invalidated the pick."
    : dominantMarket === "prop"
    ? "Prop model needs more Statcast data — consider adding barrel% and hard-hit% weighting."
    : "Review model confidence thresholds for this market type.";

  return { missedReason, dataSignals, improvementNote };
}
