import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_CONFIG } from "../domain/modelConfig";
import { type GameFeatures } from "../domain/projection";
import { analyzeGame, getConfidenceTier, selectQualifiedPicks } from "../domain/picks";

function edgeGame(overrides: Partial<GameFeatures> = {}): GameFeatures {
  return {
    gameId: "game-1",
    date: "2026-07-01",
    homeTeam: "Home Club",
    awayTeam: "Away Club",
    homeMoneyline: -105,
    awayMoneyline: -105,
    total: 8,
    overOdds: -110,
    underOdds: -110,
    runLine: -1.5,
    homeRunLineOdds: 155,
    awayRunLineOdds: -180,
    homeWrcPlus: 128,
    awayWrcPlus: 86,
    homeStarterFip: 3.05,
    awayStarterFip: 5.25,
    homeBullpenRest: 82,
    awayBullpenRest: 42,
    parkRunFactor: 106,
    weatherRunImpact: 0.4,
    homeLineupConfirmed: true,
    awayLineupConfirmed: false,
    homeRecentForm: 1.4,
    awayRecentForm: -0.8,
    ...overrides,
  };
}

describe("pick generation", () => {
  it("recommends only positive-edge picks above market threshold", () => {
    const analysis = analyzeGame(edgeGame());

    expect(analysis.picks.length).toBeGreaterThan(0);
    expect(analysis.picks.every((pick) => pick.edge >= DEFAULT_MODEL_CONFIG.thresholds[pick.market])).toBe(true);
  });

  it("stores model version, feature snapshot, and projection with every pick", () => {
    const analysis = analyzeGame(edgeGame());
    const pick = analysis.picks[0];

    expect(pick?.modelVersion).toBe(DEFAULT_MODEL_CONFIG.version);
    expect(pick?.featureSnapshot.homeWrcPlus).toBe(128);
    expect(pick?.projection.projectedHomeRuns).toBeGreaterThan(0);
    expect(pick?.projection.projectedTotal).toBeGreaterThan(0);
  });

  it("does not recommend moneyline when two-way odds are missing", () => {
    const analysis = analyzeGame(edgeGame({ homeMoneyline: undefined }));

    expect(analysis.picks.some((pick) => pick.market === "moneyline")).toBe(false);
  });

  it("assigns confidence tiers from edge size", () => {
    expect(getConfidenceTier(0.081)).toBe("A");
    expect(getConfidenceTier(0.055)).toBe("B");
    expect(getConfidenceTier(0.034)).toBe("C");
    expect(getConfidenceTier(0.02)).toBe("D");
  });

  it("selects qualified picks across games sorted by edge", () => {
    const weaker = analyzeGame(edgeGame({ gameId: "weaker", homeWrcPlus: 112 }));
    const stronger = analyzeGame(edgeGame({ gameId: "stronger", homeWrcPlus: 138 }));
    const picks = selectQualifiedPicks([weaker, stronger]);

    expect(picks.length).toBeGreaterThan(1);
    expect(picks[0]!.edge).toBeGreaterThanOrEqual(picks[1]!.edge);
  });
});

