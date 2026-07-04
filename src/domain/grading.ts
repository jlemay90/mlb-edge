import { type ParlayCard } from "./parlays.js";
import { type Pick, type PickMarket } from "./picks.js";

export type FinalGameStatus = "final" | "postponed" | "suspended" | "cancelled" | "pending";
export type PickGradeResult = "win" | "loss" | "push" | "void";
export type ParlayGradeResult = "win" | "loss" | "push" | "pending";

export type FinalGameResult = {
  gameId: string;
  status: FinalGameStatus;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
};

export type GradedPick = {
  pick: Pick;
  result: PickGradeResult;
  actualScore: string;
  actualTotal?: number;
  projectedTotal: number;
  projectedMargin: number;
  actualMargin?: number;
  modelVersion: string;
  edge: number;
  notes: string[];
};

export type GradedParlay = {
  card: ParlayCard;
  result: ParlayGradeResult;
  legs: GradedPick[];
  wins: number;
  losses: number;
  pushes: number;
  voids: number;
  missingResults: string[];
};

export type DebriefFacts = {
  result: ParlayGradeResult;
  modelVersions: string[];
  lostLegs: Array<{
    label: string;
    market: PickMarket;
    edge: number;
    actualScore: string;
  }>;
  marketMissCounts: Partial<Record<PickMarket, number>>;
  reviewSignals: string[];
  requiresCalibrationSample: boolean;
};

export function gradePick(pick: Pick, final: FinalGameResult): GradedPick {
  const notes: string[] = [];
  const projectedMargin = roundTo(pick.projection.projectedHomeRuns - pick.projection.projectedAwayRuns, 2);

  if (isVoidStatus(final.status)) {
    notes.push(`Game ${final.status}; pick is void.`);
    return buildGradedPick(pick, final, "void", notes, projectedMargin);
  }

  if (final.status !== "final" || final.homeScore === undefined || final.awayScore === undefined) {
    notes.push("Game is not final; pick cannot be graded yet.");
    return buildGradedPick(pick, final, "void", notes, projectedMargin);
  }

  const actualTotal = final.homeScore + final.awayScore;
  const actualMargin = final.homeScore - final.awayScore;
  const result = gradeFinalPick(pick, final.homeScore, final.awayScore);

  notes.push(`${final.awayTeam} ${final.awayScore}, ${final.homeTeam} ${final.homeScore}`);

  return {
    pick,
    result,
    actualScore: formatScore(final),
    actualTotal,
    projectedTotal: pick.projection.projectedTotal,
    projectedMargin,
    actualMargin,
    modelVersion: pick.modelVersion,
    edge: pick.edge,
    notes,
  };
}

export function gradeParlay(card: ParlayCard, results: FinalGameResult[]): GradedParlay {
  const resultByGame = new Map(results.map((result) => [result.gameId, result]));
  const missingResults: string[] = [];
  const legs = card.legs.flatMap((leg) => {
    const final = resultByGame.get(leg.pick.gameId);

    if (!final) {
      missingResults.push(leg.pick.gameId);
      return [];
    }

    return [gradePick(leg.pick, final)];
  });

  const wins = legs.filter((leg) => leg.result === "win").length;
  const losses = legs.filter((leg) => leg.result === "loss").length;
  const pushes = legs.filter((leg) => leg.result === "push").length;
  const voids = legs.filter((leg) => leg.result === "void").length;

  return {
    card,
    result: gradeCardResult(card.legs.length, legs.length, wins, losses, pushes, voids, missingResults),
    legs,
    wins,
    losses,
    pushes,
    voids,
    missingResults,
  };
}

export function buildPostgameDebriefFacts(graded: GradedParlay): DebriefFacts {
  const lostLegs = graded.legs
    .filter((leg) => leg.result === "loss")
    .map((leg) => ({
      label: leg.pick.label,
      market: leg.pick.market,
      edge: leg.pick.edge,
      actualScore: leg.actualScore,
    }));
  const marketMissCounts = lostLegs.reduce<Partial<Record<PickMarket, number>>>((counts, leg) => {
    counts[leg.market] = (counts[leg.market] ?? 0) + 1;
    return counts;
  }, {});

  return {
    result: graded.result,
    modelVersions: [...new Set(graded.legs.map((leg) => leg.modelVersion))],
    lostLegs,
    marketMissCounts,
    reviewSignals: buildReviewSignals(marketMissCounts),
    requiresCalibrationSample: lostLegs.length > 0,
  };
}

function gradeFinalPick(pick: Pick, homeScore: number, awayScore: number): PickGradeResult {
  switch (pick.market) {
    case "moneyline":
      return gradeMoneyline(pick.selection, homeScore, awayScore);
    case "runline":
      return gradeRunLine(pick, homeScore, awayScore);
    case "total":
      return gradeTotal(pick, homeScore + awayScore);
  }
}

function gradeMoneyline(selection: Pick["selection"], homeScore: number, awayScore: number): PickGradeResult {
  if (homeScore === awayScore) return "push";

  const homeWon = homeScore > awayScore;
  return (selection === "home" && homeWon) || (selection === "away" && !homeWon) ? "win" : "loss";
}

function gradeRunLine(pick: Pick, homeScore: number, awayScore: number): PickGradeResult {
  const homeSpread = pick.featureSnapshot.runLine ?? parseSpread(pick.label);

  if (homeSpread === undefined) {
    return "push";
  }

  const selectedScore = pick.selection === "home" ? homeScore : awayScore;
  const opponentScore = pick.selection === "home" ? awayScore : homeScore;
  const selectedSpread = pick.selection === "home" ? homeSpread : -homeSpread;
  const adjustedMargin = selectedScore + selectedSpread - opponentScore;

  if (adjustedMargin > 0) return "win";
  if (adjustedMargin < 0) return "loss";
  return "push";
}

function gradeTotal(pick: Pick, actualTotal: number): PickGradeResult {
  const line = pick.featureSnapshot.total ?? parseTotal(pick.label);

  if (line === undefined || actualTotal === line) {
    return "push";
  }

  if (pick.selection === "over") {
    return actualTotal > line ? "win" : "loss";
  }

  return actualTotal < line ? "win" : "loss";
}

function gradeCardResult(
  expectedLegs: number,
  gradedLegs: number,
  wins: number,
  losses: number,
  pushes: number,
  voids: number,
  missingResults: string[]
): ParlayGradeResult {
  if (missingResults.length > 0 || gradedLegs < expectedLegs) {
    return "pending";
  }

  if (losses > 0) {
    return "loss";
  }

  if (wins === 0 && pushes + voids === gradedLegs) {
    return "push";
  }

  return "win";
}

function buildReviewSignals(marketMissCounts: Partial<Record<PickMarket, number>>): string[] {
  return Object.keys(marketMissCounts).map(
    (market) => `Review whether ${market} threshold or source inputs need calibration.`
  );
}

function buildGradedPick(
  pick: Pick,
  final: FinalGameResult,
  result: PickGradeResult,
  notes: string[],
  projectedMargin: number
): GradedPick {
  return {
    pick,
    result,
    actualScore: formatScore(final),
    actualTotal:
      final.homeScore !== undefined && final.awayScore !== undefined ? final.homeScore + final.awayScore : undefined,
    projectedTotal: pick.projection.projectedTotal,
    projectedMargin,
    actualMargin:
      final.homeScore !== undefined && final.awayScore !== undefined ? final.homeScore - final.awayScore : undefined,
    modelVersion: pick.modelVersion,
    edge: pick.edge,
    notes,
  };
}

function isVoidStatus(status: FinalGameStatus): boolean {
  return status === "postponed" || status === "suspended" || status === "cancelled";
}

function formatScore(final: FinalGameResult): string {
  if (final.homeScore === undefined || final.awayScore === undefined) {
    return `${final.awayTeam} at ${final.homeTeam}: ${final.status}`;
  }

  return `${final.awayTeam} ${final.awayScore}, ${final.homeTeam} ${final.homeScore}`;
}

function parseSpread(label: string): number | undefined {
  const match = label.match(/[+-]\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function parseTotal(label: string): number | undefined {
  const match = label.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
