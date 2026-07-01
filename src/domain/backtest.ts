import { calculateClv } from "./odds";
import { type Pick } from "./picks";

export type BacktestResult = "win" | "loss" | "push" | "void";

export type BacktestPick = {
  pick: Pick;
  result: BacktestResult;
  actualScore: string;
  projectedTotal: number;
  projectedMargin: number;
  modelVersion: string;
  edge: number;
  notes: string[];
  closingOdds?: number;
};

export type BacktestSlate = {
  date: string;
  picks: BacktestPick[];
};

export type BacktestSummary = {
  dateRange?: {
    start: string;
    end: string;
  };
  totalPicks: number;
  record: {
    wins: number;
    losses: number;
    pushes: number;
    voids: number;
  };
  winRate: number;
  unitsStaked: number;
  profitUnits: number;
  roi: number;
  averageOdds: number;
  averageEdge: number;
  maxDrawdownUnits: number;
  clv: {
    count: number;
    averageProbabilityDelta?: number;
    missing: boolean;
  };
};

export function runBacktest(slates: BacktestSlate[]): BacktestSummary {
  const picks = slates.flatMap((slate) => slate.picks);
  const sortedDates = slates.map((slate) => slate.date).sort();
  const summary = summarizeBacktest(picks);

  if (sortedDates.length === 0) {
    return summary;
  }

  return {
    ...summary,
    dateRange: {
      start: sortedDates[0]!,
      end: sortedDates[sortedDates.length - 1]!,
    },
  };
}

export function summarizeBacktest(picks: BacktestPick[]): BacktestSummary {
  const record = {
    wins: picks.filter((pick) => pick.result === "win").length,
    losses: picks.filter((pick) => pick.result === "loss").length,
    pushes: picks.filter((pick) => pick.result === "push").length,
    voids: picks.filter((pick) => pick.result === "void").length,
  };
  const resolvedDecisions = record.wins + record.losses;
  const unitsStaked = record.wins + record.losses + record.pushes;
  const profitTimeline = picks.map((pick) => profitForPick(pick));
  const profitUnits = roundTo(profitTimeline.reduce((sum, profit) => sum + profit, 0), 4);
  const odds = average(picks.map((pick) => pick.pick.odds));
  const edges = average(picks.map((pick) => pick.edge));
  const clvValues = picks
    .filter((pick) => pick.closingOdds !== undefined)
    .map((pick) => calculateClv(pick.pick.odds, pick.closingOdds!));

  return {
    totalPicks: picks.length,
    record,
    winRate: resolvedDecisions > 0 ? roundTo(record.wins / resolvedDecisions, 4) : 0,
    unitsStaked,
    profitUnits,
    roi: unitsStaked > 0 ? roundTo(profitUnits / unitsStaked, 4) : 0,
    averageOdds: roundTo(odds, 4),
    averageEdge: roundTo(edges, 4),
    maxDrawdownUnits: calculateMaxDrawdown(profitTimeline),
    clv: {
      count: clvValues.length,
      averageProbabilityDelta: clvValues.length > 0 ? roundTo(average(clvValues), 4) : undefined,
      missing: clvValues.length === 0,
    },
  };
}

function profitForPick(pick: BacktestPick): number {
  if (pick.result === "loss") {
    return -1;
  }

  if (pick.result === "win") {
    return pick.pick.odds > 0 ? pick.pick.odds / 100 : 100 / Math.abs(pick.pick.odds);
  }

  return 0;
}

function calculateMaxDrawdown(profits: number[]): number {
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const profit of profits) {
    running += profit;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
  }

  return roundTo(maxDrawdown, 4);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
