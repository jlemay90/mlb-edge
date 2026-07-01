import { describe, expect, it } from "vitest";
import { buildPickExplanation } from "../domain/explanations";
import { analyzeGame } from "../domain/picks";
import { type GameFeatures } from "../domain/projection";

function game(overrides: Partial<GameFeatures> = {}): GameFeatures {
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

describe("pick explanations", () => {
  it("summarizes the bet, probabilities, edge, and projected score", () => {
    const pick = analyzeGame(game()).picks[0]!;
    const explanation = buildPickExplanation(pick);

    expect(explanation.title).toContain(pick.label);
    expect(explanation.narrative).toContain("model");
    expect(explanation.narrative).toContain("market");
    expect(explanation.metrics.modelProbabilityPct).toBeGreaterThan(0);
    expect(explanation.metrics.marketProbabilityPct).toBeGreaterThan(0);
    expect(explanation.metrics.edgePct).toBeGreaterThan(0);
    expect(explanation.projectedScore).toContain("Home Club");
    expect(explanation.projectedScore).toContain("Away Club");
  });

  it("uses stored model signals as explanation bullets", () => {
    const pick = analyzeGame(game()).picks[0]!;
    const explanation = buildPickExplanation(pick);

    expect(explanation.keySignals.some((signal) => signal.includes("Starter FIP"))).toBe(true);
    expect(explanation.keySignals.some((signal) => signal.includes("Park run factor"))).toBe(true);
    expect(explanation.keySignals.some((signal) => signal.includes("Weather run impact"))).toBe(true);
  });

  it("warns when important data is missing or estimated", () => {
    const pick = analyzeGame(
      game({
        weatherRunImpact: undefined,
        homeLineupConfirmed: false,
        awayLineupConfirmed: false,
        homeStarterFip: undefined,
      })
    ).picks[0]!;
    const explanation = buildPickExplanation(pick);

    expect(explanation.warnings).toContain("Weather impact is unavailable; projection uses neutral weather.");
    expect(explanation.warnings).toContain("Lineups are not fully confirmed; offense inputs are estimates.");
    expect(explanation.warnings).toContain("Starter data is incomplete; projection leans on team context.");
  });
});

