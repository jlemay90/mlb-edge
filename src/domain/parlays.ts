import { DEFAULT_MODEL_CONFIG, type ModelConfig } from "./modelConfig";
import { americanToDecimal } from "./odds";
import { type Pick } from "./picks";

export type ParlayKind = "power-pair" | "value-three" | "ceiling-four";

export type ParlayLeg = {
  pick: Pick;
  reasoning: string[];
};

export type ParlayCard = {
  id: string;
  kind: ParlayKind;
  title: string;
  legs: ParlayLeg[];
  combinedOdds: number;
  modelProbability: number;
  impliedProbability: number;
  edge: number;
  warnings: string[];
};

const SAME_GAME_WARNING = "Same-game legs are correlated; do not treat this as independent edge.";

export function buildDailyParlays(
  picks: Pick[],
  config: ModelConfig = DEFAULT_MODEL_CONFIG
): ParlayCard[] {
  const qualified = picks
    .filter((pick) => pick.edge >= config.thresholds[pick.market])
    .sort((a, b) => b.edge - a.edge);

  if (qualified.length < 2) {
    return [];
  }

  const cardPlans: Array<{ kind: ParlayKind; title: string; size: number }> = [
    { kind: "power-pair", title: "Power Pair", size: 2 },
    { kind: "value-three", title: "Value Three", size: 3 },
    { kind: "ceiling-four", title: "Ceiling Four", size: 4 },
  ];

  return cardPlans
    .filter((plan) => qualified.length >= plan.size)
    .map((plan) => makeParlayCard(plan.kind, plan.title, qualified.slice(0, plan.size)));
}

export function combineParlayOdds(odds: number[]): number {
  if (odds.length === 0) {
    throw new Error("At least one leg is required");
  }

  const decimalOdds = odds.reduce((product, legOdds) => product * americanToDecimal(legOdds), 1);

  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100);
  }

  return Math.round(-100 / (decimalOdds - 1));
}

function makeParlayCard(kind: ParlayKind, title: string, picks: Pick[]): ParlayCard {
  const combinedOdds = combineParlayOdds(picks.map((pick) => pick.odds));
  const modelProbability = roundTo(
    picks.reduce((probability, pick) => probability * pick.modelProbability, 1),
    4
  );
  const impliedProbability = roundTo(1 / picks.reduce((product, pick) => product * americanToDecimal(pick.odds), 1), 4);

  return {
    id: `${kind}:${picks.map((pick) => pick.id).join("|")}`,
    kind,
    title,
    legs: picks.map((pick) => ({
      pick,
      reasoning: [...pick.rationaleFacts],
    })),
    combinedOdds,
    modelProbability,
    impliedProbability,
    edge: roundTo(modelProbability - impliedProbability, 4),
    warnings: buildWarnings(picks),
  };
}

function buildWarnings(picks: Pick[]): string[] {
  const warnings: string[] = [];
  const uniqueGameCount = new Set(picks.map((pick) => pick.gameId)).size;

  if (uniqueGameCount < picks.length) {
    warnings.push(SAME_GAME_WARNING);
  }

  return warnings;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
