import { DEFAULT_MODEL_CONFIG, type Market, type ModelConfig } from "./modelConfig";
import { removeVigTwoWay } from "./odds";
import {
  calculateRunLineProbability,
  calculateTotalProbability,
  projectGame,
  type GameFeatures,
  type GameProjection,
} from "./projection";

export type PickMarket = Exclude<Market, "prop">;
export type ConfidenceTier = "A" | "B" | "C" | "D";

export type Pick = {
  id: string;
  gameId: string;
  date: string;
  market: PickMarket;
  selection: "home" | "away" | "over" | "under";
  label: string;
  odds: number;
  modelProbability: number;
  impliedProbability: number;
  edge: number;
  confidenceTier: ConfidenceTier;
  modelVersion: string;
  featureSnapshot: GameFeatures;
  projection: GameProjection;
  rationaleFacts: string[];
};

export type GameAnalysis = {
  gameId: string;
  projection: GameProjection;
  picks: Pick[];
};

export function analyzeGame(
  features: GameFeatures,
  config: ModelConfig = DEFAULT_MODEL_CONFIG
): GameAnalysis {
  const projection = projectGame(features, config);
  const picks = [
    buildMoneylinePick(features, projection, config),
    buildRunlinePick(features, projection, config),
    buildTotalPick(features, projection, config),
  ].filter((pick): pick is Pick => pick !== null);

  return {
    gameId: features.gameId,
    projection,
    picks: picks.sort((a, b) => b.edge - a.edge),
  };
}

export function selectQualifiedPicks(
  analyses: GameAnalysis[],
  config: ModelConfig = DEFAULT_MODEL_CONFIG
): Pick[] {
  return analyses
    .flatMap((analysis) => analysis.picks)
    .filter((pick) => pick.edge >= config.thresholds[pick.market])
    .sort((a, b) => b.edge - a.edge);
}

export function getConfidenceTier(edge: number): ConfidenceTier {
  if (edge >= 0.08) return "A";
  if (edge >= 0.05) return "B";
  if (edge >= 0.03) return "C";
  return "D";
}

function buildMoneylinePick(
  features: GameFeatures,
  projection: GameProjection,
  config: ModelConfig
): Pick | null {
  if (features.homeMoneyline === undefined || features.awayMoneyline === undefined) {
    return null;
  }

  const noVig = removeVigTwoWay(features.homeMoneyline, features.awayMoneyline);
  const homeEdge = projection.homeWinProbability - noVig.a;
  const awayEdge = projection.awayWinProbability - noVig.b;
  const isHome = homeEdge >= awayEdge;
  const edge = isHome ? homeEdge : awayEdge;

  if (edge < config.thresholds.moneyline) {
    return null;
  }

  return makePick({
    features,
    projection,
    config,
    market: "moneyline",
    selection: isHome ? "home" : "away",
    odds: isHome ? features.homeMoneyline : features.awayMoneyline,
    modelProbability: isHome ? projection.homeWinProbability : projection.awayWinProbability,
    impliedProbability: isHome ? noVig.a : noVig.b,
    edge,
    label: `${isHome ? features.homeTeam : features.awayTeam} ML`,
  });
}

function buildRunlinePick(
  features: GameFeatures,
  projection: GameProjection,
  config: ModelConfig
): Pick | null {
  if (
    features.runLine === undefined ||
    features.homeRunLineOdds === undefined ||
    features.awayRunLineOdds === undefined
  ) {
    return null;
  }

  const runDiff = projection.projectedHomeRuns - projection.projectedAwayRuns;
  const probabilities = calculateRunLineProbability(runDiff, features.runLine);
  const noVig = removeVigTwoWay(features.homeRunLineOdds, features.awayRunLineOdds);
  const homeEdge = probabilities.home - noVig.a;
  const awayEdge = probabilities.away - noVig.b;
  const isHome = homeEdge >= awayEdge;
  const edge = isHome ? homeEdge : awayEdge;

  if (edge < config.thresholds.runline) {
    return null;
  }

  const awaySpread = -features.runLine;
  const spread = isHome ? features.runLine : awaySpread;

  return makePick({
    features,
    projection,
    config,
    market: "runline",
    selection: isHome ? "home" : "away",
    odds: isHome ? features.homeRunLineOdds : features.awayRunLineOdds,
    modelProbability: isHome ? probabilities.home : probabilities.away,
    impliedProbability: isHome ? noVig.a : noVig.b,
    edge,
    label: `${isHome ? features.homeTeam : features.awayTeam} ${formatSpread(spread)}`,
  });
}

function buildTotalPick(
  features: GameFeatures,
  projection: GameProjection,
  config: ModelConfig
): Pick | null {
  if (features.total === undefined || features.overOdds === undefined || features.underOdds === undefined) {
    return null;
  }

  const probabilities = calculateTotalProbability(projection.projectedTotal, features.total);
  const noVig = removeVigTwoWay(features.overOdds, features.underOdds);
  const overEdge = probabilities.over - noVig.a;
  const underEdge = probabilities.under - noVig.b;
  const isOver = overEdge >= underEdge;
  const edge = isOver ? overEdge : underEdge;

  if (edge < config.thresholds.total) {
    return null;
  }

  return makePick({
    features,
    projection,
    config,
    market: "total",
    selection: isOver ? "over" : "under",
    odds: isOver ? features.overOdds : features.underOdds,
    modelProbability: isOver ? probabilities.over : probabilities.under,
    impliedProbability: isOver ? noVig.a : noVig.b,
    edge,
    label: `${isOver ? "Over" : "Under"} ${features.total}`,
  });
}

function makePick(input: {
  features: GameFeatures;
  projection: GameProjection;
  config: ModelConfig;
  market: PickMarket;
  selection: Pick["selection"];
  label: string;
  odds: number;
  modelProbability: number;
  impliedProbability: number;
  edge: number;
}): Pick {
  const id = `${input.features.gameId}:${input.market}:${input.selection}`;

  return {
    id,
    gameId: input.features.gameId,
    date: input.features.date,
    market: input.market,
    selection: input.selection,
    label: input.label,
    odds: input.odds,
    modelProbability: roundTo(input.modelProbability, 4),
    impliedProbability: roundTo(input.impliedProbability, 4),
    edge: roundTo(input.edge, 4),
    confidenceTier: getConfidenceTier(input.edge),
    modelVersion: input.config.version,
    featureSnapshot: { ...input.features },
    projection: input.projection,
    rationaleFacts: buildRationaleFacts(input.features, input.projection, input.edge),
  };
}

function buildRationaleFacts(
  features: GameFeatures,
  projection: GameProjection,
  edge: number
): string[] {
  const facts = [
    `Model projects ${projection.projectedHomeRuns}-${projection.projectedAwayRuns}`,
    `Projected total ${projection.projectedTotal}`,
    `Edge ${(edge * 100).toFixed(1)}%`,
  ];

  if (features.homeStarterFip !== undefined && features.awayStarterFip !== undefined) {
    facts.push(`Starter FIP ${features.homeStarterFip.toFixed(2)} vs ${features.awayStarterFip.toFixed(2)}`);
  }

  if (features.parkRunFactor !== undefined) {
    facts.push(`Park run factor ${features.parkRunFactor}`);
  }

  if (features.weatherRunImpact !== undefined) {
    facts.push(`Weather run impact ${features.weatherRunImpact.toFixed(1)}`);
  }

  return facts;
}

function formatSpread(spread: number): string {
  return `${spread > 0 ? "+" : ""}${spread}`;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
