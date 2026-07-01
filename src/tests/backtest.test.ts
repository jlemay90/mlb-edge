import { describe, expect, it } from "vitest";
import { runBacktest, summarizeBacktest, type BacktestPick } from "../domain/backtest";
import { type Pick } from "../domain/picks";

function graded(
  result: BacktestPick["result"],
  overrides: Partial<Pick> & { closingOdds?: number; date?: string } = {}
): BacktestPick {
  const pick = {
    id: overrides.id ?? `${overrides.date ?? "2026-06-01"}:${overrides.market ?? "moneyline"}:${overrides.selection ?? "home"}`,
    gameId: overrides.gameId ?? "game-1",
    date: overrides.date ?? "2026-06-01",
    market: overrides.market ?? "moneyline",
    selection: overrides.selection ?? "home",
    label: overrides.label ?? "Home Club ML",
    odds: overrides.odds ?? -110,
    modelProbability: overrides.modelProbability ?? 0.57,
    impliedProbability: overrides.impliedProbability ?? 0.51,
    edge: overrides.edge ?? 0.06,
    confidenceTier: overrides.confidenceTier ?? "A",
    modelVersion: overrides.modelVersion ?? "1.0.0",
  } as Pick;

  return {
    pick,
    result,
    actualScore: "Away Club 3, Home Club 5",
    projectedTotal: 8.7,
    projectedMargin: 1.2,
    modelVersion: pick.modelVersion,
    edge: pick.edge,
    notes: [],
    closingOdds: overrides.closingOdds,
  };
}

describe("backtesting", () => {
  it("summarizes record, units, ROI, average odds, average edge, and drawdown", () => {
    const summary = summarizeBacktest([
      graded("win", { odds: -110, edge: 0.06, date: "2026-06-01" }),
      graded("loss", { odds: 120, edge: 0.04, date: "2026-06-02" }),
      graded("push", { odds: -105, edge: 0.03, date: "2026-06-03" }),
      graded("void", { odds: -115, edge: 0.08, date: "2026-06-04" }),
    ]);

    expect(summary.totalPicks).toBe(4);
    expect(summary.record).toEqual({ wins: 1, losses: 1, pushes: 1, voids: 1 });
    expect(summary.winRate).toBe(0.5);
    expect(summary.unitsStaked).toBe(3);
    expect(summary.profitUnits).toBeCloseTo(-0.09, 2);
    expect(summary.roi).toBeCloseTo(-0.03, 2);
    expect(summary.averageOdds).toBeCloseTo(-52.5, 1);
    expect(summary.averageEdge).toBeCloseTo(0.0525, 4);
    expect(summary.maxDrawdownUnits).toBeGreaterThan(0.9);
  });

  it("reports date ranges and CLV when closing odds are available", () => {
    const summary = runBacktest([
      { date: "2026-06-01", picks: [graded("win", { odds: -110, closingOdds: -130, date: "2026-06-01" })] },
      { date: "2026-06-02", picks: [graded("loss", { odds: 120, closingOdds: 100, date: "2026-06-02" })] },
    ]);

    expect(summary.dateRange).toEqual({ start: "2026-06-01", end: "2026-06-02" });
    expect(summary.clv.count).toBe(2);
    expect(summary.clv.averageProbabilityDelta).toBeGreaterThan(0);
    expect(summary.clv.missing).toBe(false);
  });

  it("flags missing CLV instead of pretending closing-line evidence exists", () => {
    const summary = summarizeBacktest([graded("win"), graded("loss", { odds: 105 })]);

    expect(summary.clv.count).toBe(0);
    expect(summary.clv.averageProbabilityDelta).toBeUndefined();
    expect(summary.clv.missing).toBe(true);
  });
});
