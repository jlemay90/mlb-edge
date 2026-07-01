import { describe, expect, it } from "vitest";
import {
  buildHistoricalBacktestReadiness,
  getDefaultCompletedSeasons,
  runHistoricalBacktest,
  type HistoricalSeasonReplay,
} from "../domain/historicalBacktest";
import { type BacktestPick } from "../domain/backtest";
import { type Pick } from "../domain/picks";

function backtestPick(id: string, result: BacktestPick["result"] = "win"): BacktestPick {
  const pick = {
    id,
    gameId: `game-${id}`,
    date: "2025-06-01",
    market: "moneyline",
    selection: "home",
    label: "Home Club ML",
    odds: -110,
    modelProbability: 0.57,
    impliedProbability: 0.51,
    edge: 0.06,
    confidenceTier: "A",
    modelVersion: "1.0.0",
  } as Pick;

  return {
    pick,
    result,
    actualScore: "Away Club 3, Home Club 5",
    projectedTotal: 8.5,
    projectedMargin: 1.2,
    modelVersion: "1.0.0",
    edge: 0.06,
    notes: [],
    closingOdds: -125,
  };
}

function seasonReplay(season: number, overrides: Partial<HistoricalSeasonReplay> = {}): HistoricalSeasonReplay {
  return {
    season,
    slates: [
      {
        date: `${season}-06-01`,
        picks: [
          backtestPick(`${season}-a`, "win"),
          backtestPick(`${season}-b`, "loss"),
        ],
      },
    ],
    coverage: {
      scheduledGames: 2,
      finalResults: 2,
      oddsSnapshots: 2,
      weatherSnapshots: 2,
      parkFactors: 2,
      featureSnapshots: 2,
      missingSignals: [],
      blockers: [],
    },
    ...overrides,
  };
}

describe("historical backtest orchestration", () => {
  it("defaults to the five most recent completed MLB seasons", () => {
    expect(getDefaultCompletedSeasons("2026-07-01")).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(getDefaultCompletedSeasons("2026-12-01")).toEqual([2022, 2023, 2024, 2025, 2026]);
  });

  it("reports missing imported replay data instead of treating preview samples as historical proof", () => {
    const report = buildHistoricalBacktestReadiness({
      asOfDateIso: "2026-07-01",
      oddsApiConfigured: false,
    });

    expect(report.seasons).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(report.status).toBe("blocked");
    expect(report.summary.totalPicks).toBe(0);
    expect(report.canClaimHighSuccessRate).toBe(false);
    expect(report.blockers.join(" ")).toContain("ODDS_API_KEY");
    expect(report.blockers.join(" ")).toContain("imported historical replay data");
  });

  it("blocks high-success claims when historical odds access is missing", async () => {
    const report = await runHistoricalBacktest({
      seasons: [2021, 2022, 2023, 2024, 2025],
      loadSeason: async (season) =>
        seasonReplay(season, {
          coverage: {
            scheduledGames: 100,
            finalResults: 100,
            oddsSnapshots: 0,
            weatherSnapshots: 100,
            parkFactors: 100,
            featureSnapshots: 0,
            missingSignals: ["historical odds"],
            blockers: ["The Odds API historical odds endpoint is unavailable for this key or plan."],
          },
        }),
    });

    expect(report.status).toBe("blocked");
    expect(report.canClaimHighSuccessRate).toBe(false);
    expect(report.blockers.join(" ")).toContain("historical odds");
  });

  it("marks the replay verified only when five complete seasons include all required signals", async () => {
    const report = await runHistoricalBacktest({
      seasons: [2021, 2022, 2023, 2024, 2025],
      loadSeason: async (season) => seasonReplay(season),
    });

    expect(report.status).toBe("verified");
    expect(report.completedSeasonCount).toBe(5);
    expect(report.summary.totalPicks).toBe(10);
    expect(report.coverage.every((season) => season.complete)).toBe(true);
    expect(report.canClaimHighSuccessRate).toBe(report.summary.roi > 0 && report.summary.winRate >= 0.55);
  });

  it("stays partial when fewer than five seasons are replayed", async () => {
    const report = await runHistoricalBacktest({
      seasons: [2022, 2023, 2024, 2025],
      loadSeason: async (season) => seasonReplay(season),
    });

    expect(report.status).toBe("partial");
    expect(report.completedSeasonCount).toBe(4);
    expect(report.canClaimHighSuccessRate).toBe(false);
    expect(report.blockers.join(" ")).toContain("Need 5 completed seasons");
  });
});
