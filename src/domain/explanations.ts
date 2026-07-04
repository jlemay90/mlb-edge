import { type Pick } from "./picks.js";

export type PickExplanation = {
  title: string;
  narrative: string;
  projectedScore: string;
  metrics: {
    modelProbabilityPct: number;
    marketProbabilityPct: number;
    edgePct: number;
  };
  keySignals: string[];
  warnings: string[];
};

export function buildPickExplanation(pick: Pick): PickExplanation {
  const metrics = {
    modelProbabilityPct: toPct(pick.modelProbability),
    marketProbabilityPct: toPct(pick.impliedProbability),
    edgePct: toPct(pick.edge),
  };
  const projectedScore = `${pick.featureSnapshot.homeTeam} ${pick.projection.projectedHomeRuns}, ${pick.featureSnapshot.awayTeam} ${pick.projection.projectedAwayRuns}`;
  const warnings = buildWarnings(pick);
  const keySignals = [...pick.rationaleFacts];

  return {
    title: `${pick.label} at ${formatOdds(pick.odds)}`,
    narrative:
      `${pick.label} makes sense because the model prices it at ${metrics.modelProbabilityPct.toFixed(1)}% ` +
      `against a no-vig market probability of ${metrics.marketProbabilityPct.toFixed(1)}%, ` +
      `creating a ${metrics.edgePct.toFixed(1)}% edge. ` +
      `The saved projection is ${projectedScore}, with a game total projection of ${pick.projection.projectedTotal}.`,
    projectedScore,
    metrics,
    keySignals,
    warnings,
  };
}

function buildWarnings(pick: Pick): string[] {
  const warnings: string[] = [];
  const features = pick.featureSnapshot;

  if (features.weatherRunImpact === undefined) {
    warnings.push("Weather impact is unavailable; projection uses neutral weather.");
  }

  if (!features.homeLineupConfirmed || !features.awayLineupConfirmed) {
    warnings.push("Lineups are not fully confirmed; offense inputs are estimates.");
  }

  if (features.homeStarterFip === undefined || features.awayStarterFip === undefined) {
    warnings.push("Starter data is incomplete; projection leans on team context.");
  }

  return warnings;
}

function toPct(value: number): number {
  return Math.round(value * 1000) / 10;
}

function formatOdds(odds: number): string {
  return `${odds > 0 ? "+" : ""}${odds}`;
}

