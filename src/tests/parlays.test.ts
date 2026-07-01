import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_CONFIG } from "../domain/modelConfig";
import { buildDailyParlays, combineParlayOdds } from "../domain/parlays";
import { type Pick } from "../domain/picks";

function pick(overrides: Partial<Pick> = {}): Pick {
  const gameId = overrides.gameId ?? "game-1";
  const market = overrides.market ?? "moneyline";
  const selection = overrides.selection ?? "home";
  const featureSnapshot = {
    gameId,
    date: "2026-07-01",
    homeTeam: "Home Club",
    awayTeam: "Away Club",
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
    odds: overrides.odds ?? -110,
    modelProbability: overrides.modelProbability ?? 0.58,
    impliedProbability: overrides.impliedProbability ?? 0.5,
    edge: overrides.edge ?? 0.08,
    confidenceTier: overrides.confidenceTier ?? "A",
    modelVersion: overrides.modelVersion ?? DEFAULT_MODEL_CONFIG.version,
    featureSnapshot,
    projection: {
      features: featureSnapshot,
      projectedHomeRuns: 5.1,
      projectedAwayRuns: 3.8,
      projectedTotal: 8.9,
      homeWinProbability: 0.6,
      awayWinProbability: 0.4,
    },
    rationaleFacts: overrides.rationaleFacts ?? [
      "Model projects 5.1-3.8",
      "Edge 8.0%",
    ],
    ...overrides,
  };
}

describe("parlay assembly", () => {
  it("combines American odds into one parlay price", () => {
    expect(combineParlayOdds([-110, -110])).toBe(264);
    expect(combineParlayOdds([-150, 120])).toBe(267);
  });

  it("builds parlay cards from qualified picks only", () => {
    const cards = buildDailyParlays([
      pick({ id: "a", gameId: "game-a", edge: 0.09 }),
      pick({ id: "b", gameId: "game-b", edge: 0.07, market: "total", selection: "over", label: "Over 8" }),
      pick({ id: "weak", gameId: "game-c", edge: 0.01, label: "Weak lean" }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]!.legs).toHaveLength(2);
    expect(cards[0]!.legs.every((leg) => leg.pick.edge >= DEFAULT_MODEL_CONFIG.thresholds[leg.pick.market])).toBe(true);
    expect(cards[0]!.legs.some((leg) => leg.pick.id === "weak")).toBe(false);
  });

  it("keeps the reasoning for every parlay leg", () => {
    const cards = buildDailyParlays([
      pick({ id: "a", gameId: "game-a", rationaleFacts: ["Starter edge", "Bullpen rest edge"] }),
      pick({ id: "b", gameId: "game-b", edge: 0.07, rationaleFacts: ["Weather boosts run scoring"] }),
    ]);

    expect(cards[0]!.legs[0]!.reasoning).toContain("Starter edge");
    expect(cards[0]!.legs[1]!.reasoning).toContain("Weather boosts run scoring");
  });

  it("keeps the matchup visible for every parlay leg", () => {
    const cards = buildDailyParlays([
      pick({ id: "a", gameId: "game-a" }),
      pick({ id: "b", gameId: "game-b", edge: 0.07 }),
    ]);

    expect(cards[0]!.legs.map((leg) => leg.matchup)).toEqual([
      "Away Club at Home Club",
      "Away Club at Home Club",
    ]);
  });

  it("warns when selected legs come from the same game", () => {
    const cards = buildDailyParlays([
      pick({ id: "game-1:moneyline:home", gameId: "game-1", market: "moneyline", selection: "home", edge: 0.09 }),
      pick({ id: "game-1:total:over", gameId: "game-1", market: "total", selection: "over", label: "Over 8", edge: 0.08 }),
    ]);

    expect(cards[0]!.warnings).toContain("Same-game legs are correlated; do not treat this as independent edge.");
  });

  it("refuses to create cards when there are too few qualified legs", () => {
    const cards = buildDailyParlays([
      pick({ id: "qualified", edge: 0.08 }),
      pick({ id: "too-weak", gameId: "game-b", edge: 0.01 }),
    ]);

    expect(cards).toEqual([]);
  });
});
