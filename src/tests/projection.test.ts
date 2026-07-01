import { describe, expect, it } from "vitest";
import {
  calculateRunLineProbability,
  calculateTotalProbability,
  calculateWinProbabilities,
  projectGame,
  projectTeamRuns,
  type GameFeatures,
} from "../domain/projection";

function baseFeatures(overrides: Partial<GameFeatures> = {}): GameFeatures {
  return {
    gameId: "game-1",
    date: "2026-07-01",
    homeTeam: "Home Club",
    awayTeam: "Away Club",
    homeMoneyline: -110,
    awayMoneyline: -110,
    total: 8.5,
    overOdds: -110,
    underOdds: -110,
    runLine: -1.5,
    homeRunLineOdds: 145,
    awayRunLineOdds: -165,
    homeWrcPlus: 100,
    awayWrcPlus: 100,
    homeStarterFip: 4,
    awayStarterFip: 4,
    homeBullpenRest: 70,
    awayBullpenRest: 70,
    parkRunFactor: 100,
    weatherRunImpact: 0,
    homeLineupConfirmed: false,
    awayLineupConfirmed: false,
    homeRecentForm: 0,
    awayRecentForm: 0,
    ...overrides,
  };
}

describe("run projection", () => {
  it("increases a team's projected runs for stronger offense", () => {
    const weak = projectTeamRuns(baseFeatures({ homeWrcPlus: 88 }), "home");
    const strong = projectTeamRuns(baseFeatures({ homeWrcPlus: 118 }), "home");

    expect(strong).toBeGreaterThan(weak);
  });

  it("lowers projected runs against a stronger opposing starter", () => {
    const vsAce = projectTeamRuns(baseFeatures({ awayStarterFip: 2.9 }), "home");
    const vsWeakStarter = projectTeamRuns(baseFeatures({ awayStarterFip: 5.2 }), "home");

    expect(vsWeakStarter).toBeGreaterThan(vsAce);
  });

  it("raises total projection in hitter-friendly weather and park context", () => {
    const neutral = projectGame(baseFeatures());
    const hitterContext = projectGame(baseFeatures({ parkRunFactor: 112, weatherRunImpact: 0.7 }));

    expect(hitterContext.projectedTotal).toBeGreaterThan(neutral.projectedTotal);
  });

  it("moves win probability toward the higher projected team", () => {
    const probs = calculateWinProbabilities(5.2, 3.9);

    expect(probs.home).toBeGreaterThan(0.5);
    expect(probs.away).toBeLessThan(0.5);
    expect(probs.home + probs.away).toBeCloseTo(1, 5);
  });

  it("calculates total over probability above 50% when projection clears book total", () => {
    const probs = calculateTotalProbability(9.6, 8.5);

    expect(probs.over).toBeGreaterThan(0.5);
    expect(probs.under).toBeLessThan(0.5);
  });

  it("calculates run-line cover probability from projected margin", () => {
    const probs = calculateRunLineProbability(2.3, -1.5);

    expect(probs.home).toBeGreaterThan(0.5);
    expect(probs.away).toBeLessThan(0.5);
  });
});

