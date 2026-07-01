import { describe, expect, it } from "vitest";
import { gradeParlay, gradePick, buildPostgameDebriefFacts, type FinalGameResult } from "../domain/grading";
import { buildDailyParlays } from "../domain/parlays";
import { type Pick } from "../domain/picks";

function finalResult(overrides: Partial<FinalGameResult> = {}): FinalGameResult {
  return {
    gameId: "game-1",
    status: "final",
    homeTeam: "Home Club",
    awayTeam: "Away Club",
    homeScore: 5,
    awayScore: 3,
    ...overrides,
  };
}

function pick(overrides: Partial<Pick> = {}): Pick {
  const gameId = overrides.gameId ?? "game-1";
  const market = overrides.market ?? "moneyline";
  const selection = overrides.selection ?? "home";
  const featureSnapshot = {
    gameId,
    date: "2026-07-01",
    homeTeam: "Home Club",
    awayTeam: "Away Club",
    homeMoneyline: -120,
    awayMoneyline: 105,
    total: 8,
    overOdds: -110,
    underOdds: -110,
    runLine: -1.5,
    homeRunLineOdds: 145,
    awayRunLineOdds: -165,
    homeWrcPlus: 118,
    awayWrcPlus: 91,
  };

  return {
    id: `${gameId}:${market}:${selection}`,
    gameId,
    date: "2026-07-01",
    market,
    selection,
    label: overrides.label ?? "Home Club ML",
    odds: overrides.odds ?? -120,
    modelProbability: overrides.modelProbability ?? 0.58,
    impliedProbability: overrides.impliedProbability ?? 0.5,
    edge: overrides.edge ?? 0.08,
    confidenceTier: overrides.confidenceTier ?? "A",
    modelVersion: overrides.modelVersion ?? "1.0.0",
    featureSnapshot,
    projection: {
      features: featureSnapshot,
      projectedHomeRuns: 5.1,
      projectedAwayRuns: 3.8,
      projectedTotal: 8.9,
      homeWinProbability: 0.6,
      awayWinProbability: 0.4,
    },
    rationaleFacts: overrides.rationaleFacts ?? ["Starter edge", "Bullpen rest edge"],
    ...overrides,
  };
}

describe("pick grading", () => {
  it("grades moneyline wins and losses", () => {
    expect(gradePick(pick({ selection: "home" }), finalResult()).result).toBe("win");
    expect(gradePick(pick({ selection: "away", label: "Away Club ML" }), finalResult()).result).toBe("loss");
  });

  it("grades run line covers and fails", () => {
    expect(
      gradePick(
        pick({ market: "runline", selection: "home", label: "Home Club -1.5", odds: 145 }),
        finalResult({ homeScore: 5, awayScore: 3 })
      ).result
    ).toBe("win");
    expect(
      gradePick(
        pick({ market: "runline", selection: "home", label: "Home Club -1.5", odds: 145 }),
        finalResult({ homeScore: 4, awayScore: 3 })
      ).result
    ).toBe("loss");
  });

  it("grades totals over, under, and push", () => {
    expect(
      gradePick(pick({ market: "total", selection: "over", label: "Over 8" }), finalResult({ homeScore: 6, awayScore: 4 })).result
    ).toBe("win");
    expect(
      gradePick(pick({ market: "total", selection: "under", label: "Under 8" }), finalResult({ homeScore: 2, awayScore: 3 })).result
    ).toBe("win");
    expect(
      gradePick(pick({ market: "total", selection: "over", label: "Over 8" }), finalResult({ homeScore: 5, awayScore: 3 })).result
    ).toBe("push");
  });

  it("voids postponed games without treating them as losses", () => {
    const graded = gradePick(pick(), finalResult({ status: "postponed", homeScore: undefined, awayScore: undefined }));

    expect(graded.result).toBe("void");
    expect(graded.notes).toContain("Game postponed; pick is void.");
  });
});

describe("parlay grading", () => {
  it("grades parlay cards as win, loss, or push", () => {
    const winningCard = buildDailyParlays([
      pick({ id: "ml", gameId: "game-1", market: "moneyline", selection: "home" }),
      pick({ id: "total", gameId: "game-1", market: "total", selection: "over", label: "Over 8" }),
    ])[0]!;
    const losingCard = buildDailyParlays([
      pick({ id: "ml", gameId: "game-1", market: "moneyline", selection: "home" }),
      pick({ id: "away", gameId: "game-1", market: "moneyline", selection: "away", label: "Away Club ML" }),
    ])[0]!;
    const pushCard = buildDailyParlays([
      pick({ id: "over", gameId: "game-1", market: "total", selection: "over", label: "Over 8" }),
      pick({ id: "under", gameId: "game-1", market: "total", selection: "under", label: "Under 8" }),
    ])[0]!;

    expect(gradeParlay(winningCard, [finalResult({ homeScore: 6, awayScore: 4 })]).result).toBe("win");
    expect(gradeParlay(losingCard, [finalResult({ homeScore: 5, awayScore: 3 })]).result).toBe("loss");
    expect(gradeParlay(pushCard, [finalResult({ homeScore: 5, awayScore: 3 })]).result).toBe("push");
  });

  it("builds postgame debrief facts without making automatic model changes", () => {
    const card = buildDailyParlays([
      pick({ id: "ml", gameId: "game-1", market: "moneyline", selection: "home", modelVersion: "1.2.3" }),
      pick({ id: "away", gameId: "game-1", market: "moneyline", selection: "away", label: "Away Club ML", modelVersion: "1.2.3" }),
    ])[0]!;
    const graded = gradeParlay(card, [finalResult({ homeScore: 5, awayScore: 3 })]);
    const facts = buildPostgameDebriefFacts(graded);

    expect(facts.modelVersions).toEqual(["1.2.3"]);
    expect(facts.lostLegs).toHaveLength(1);
    expect(facts.marketMissCounts.moneyline).toBe(1);
    expect(facts.reviewSignals).toContain("Review whether moneyline threshold or source inputs need calibration.");
    expect(facts.requiresCalibrationSample).toBe(true);
  });
});
