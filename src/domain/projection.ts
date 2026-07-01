import { DEFAULT_MODEL_CONFIG, type ModelConfig } from "./modelConfig";

export type GameFeatures = {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeMoneyline?: number;
  awayMoneyline?: number;
  total?: number;
  overOdds?: number;
  underOdds?: number;
  runLine?: number;
  homeRunLineOdds?: number;
  awayRunLineOdds?: number;
  homeWrcPlus?: number;
  awayWrcPlus?: number;
  homeStarterFip?: number;
  awayStarterFip?: number;
  homeBullpenRest?: number;
  awayBullpenRest?: number;
  parkRunFactor?: number;
  weatherRunImpact?: number;
  homeLineupConfirmed?: boolean;
  awayLineupConfirmed?: boolean;
  homeRecentForm?: number;
  awayRecentForm?: number;
};

export type GameProjection = {
  features: GameFeatures;
  projectedHomeRuns: number;
  projectedAwayRuns: number;
  projectedTotal: number;
  homeWinProbability: number;
  awayWinProbability: number;
};

const LEAGUE_RUNS_PER_TEAM = 4.55;
const LEAGUE_STARTER_FIP = 4.1;

export function projectTeamRuns(
  features: GameFeatures,
  side: "home" | "away",
  config: ModelConfig = DEFAULT_MODEL_CONFIG
): number {
  const isHome = side === "home";
  const offense = isHome ? features.homeWrcPlus : features.awayWrcPlus;
  const opposingStarterFip = isHome ? features.awayStarterFip : features.homeStarterFip;
  const opposingBullpenRest = isHome ? features.awayBullpenRest : features.homeBullpenRest;
  const lineupConfirmed = isHome ? features.homeLineupConfirmed : features.awayLineupConfirmed;
  const recentForm = isHome ? features.homeRecentForm : features.awayRecentForm;

  let runs = LEAGUE_RUNS_PER_TEAM;

  if (offense !== undefined) {
    runs += ((offense - 100) / 100) * LEAGUE_RUNS_PER_TEAM * config.weights.offense;
  }

  if (opposingStarterFip !== undefined) {
    runs += (opposingStarterFip - LEAGUE_STARTER_FIP) * config.weights.starter;
  }

  if (opposingBullpenRest !== undefined) {
    runs += ((60 - opposingBullpenRest) / 50) * config.weights.bullpen;
  }

  if (features.parkRunFactor !== undefined) {
    runs *= 1 + ((features.parkRunFactor - 100) / 100) * config.weights.park;
  }

  if (features.weatherRunImpact !== undefined) {
    runs += (features.weatherRunImpact / 2) * config.weights.weather;
  }

  if (lineupConfirmed) {
    runs += 0.08 * config.weights.lineup;
  }

  if (recentForm !== undefined) {
    runs += recentForm * config.weights.recentForm;
  }

  if (isHome) {
    runs += 0.12;
  }

  return roundTo(runs, 2);
}

export function projectGame(
  features: GameFeatures,
  config: ModelConfig = DEFAULT_MODEL_CONFIG
): GameProjection {
  const projectedHomeRuns = projectTeamRuns(features, "home", config);
  const projectedAwayRuns = projectTeamRuns(features, "away", config);
  const winProbabilities = calculateWinProbabilities(projectedHomeRuns, projectedAwayRuns);

  return {
    features,
    projectedHomeRuns,
    projectedAwayRuns,
    projectedTotal: roundTo(projectedHomeRuns + projectedAwayRuns, 2),
    homeWinProbability: winProbabilities.home,
    awayWinProbability: winProbabilities.away,
  };
}

export function calculateWinProbabilities(
  projectedHomeRuns: number,
  projectedAwayRuns: number
): { home: number; away: number } {
  const runDiff = projectedHomeRuns - projectedAwayRuns;
  const home = sigmoid(runDiff * 0.42);

  return {
    home: roundTo(home, 4),
    away: roundTo(1 - home, 4),
  };
}

export function calculateTotalProbability(
  projectedTotal: number,
  bookTotal: number
): { over: number; under: number } {
  const z = (projectedTotal - bookTotal) / 3.2;
  const over = sigmoid(z * 1.7);

  return {
    over: roundTo(over, 4),
    under: roundTo(1 - over, 4),
  };
}

export function calculateRunLineProbability(
  runDiff: number,
  homeSpread: number
): { home: number; away: number } {
  const homeCoverMargin = runDiff + homeSpread;
  const home = sigmoid(homeCoverMargin * 0.85);

  return {
    home: roundTo(home, 4),
    away: roundTo(1 - home, 4),
  };
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

