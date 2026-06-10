/**
 * Parlay Engine Unit Tests
 * Covers: odds math, all 5 parlay types, loss analysis, candidate extraction
 */

import { describe, it, expect } from "vitest";
import {
  combineParlayOdds,
  generateDailyParlays,
  analyzeLoss,
  type ParlayType,
} from "./services/parlayEngine";

// ─── Odds Math ────────────────────────────────────────────────────────────────

describe("combineParlayOdds", () => {
  it("combines two -110 legs to ~+264", () => {
    const result = combineParlayOdds([-110, -110]);
    // 1.909 * 1.909 = 3.645 decimal → +265 American
    expect(result).toBeGreaterThan(250);
    expect(result).toBeLessThan(280);
  });

  it("single leg returns same odds", () => {
    expect(combineParlayOdds([+150])).toBe(150);
    expect(combineParlayOdds([-200])).toBe(-200);
  });

  it("handles positive odds correctly", () => {
    // +200 = 3.0 decimal, +300 = 4.0 decimal → 12.0 → +1100
    const result = combineParlayOdds([+200, +300]);
    expect(result).toBeGreaterThan(1000);
  });

  it("5-leg parlay of -110 reaches +2000+", () => {
    const result = combineParlayOdds([-110, -110, -110, -110, -110]);
    expect(result).toBeGreaterThan(2000);
  });
});

// ─── Mock Game Builder ────────────────────────────────────────────────────────

function mockGame(overrides: any = {}): any {
  return {
    gamePk: overrides.gamePk ?? Math.floor(Math.random() * 100000),
    gameDate: "2026-06-10",
    homeTeam: { id: 147, name: "New York Yankees" },
    awayTeam: { id: 111, name: "Boston Red Sox" },
    homePitcher: { name: "Gerrit Cole", era: 3.20, fip: 3.10 },
    awayPitcher: { name: "Brayan Bello", era: 4.80, fip: 4.60 },
    weather: { temp: 82, windSpeed: 14, windDir: "Out to CF", humidity: 55 },
    parkFactor: { runs: 108, hr: 112 },
    predictions: {
      moneyLine: {
        pick: "home",
        pickLabel: "Yankees ML",
        odds: -145,
        edgeScore: 0.08,
        modelProbability: 0.62,
        confidenceTier: "A",
      },
      runLine: {
        pick: "home",
        pickLabel: "Yankees -1.5",
        odds: +115,
        edgeScore: 0.06,
        modelProbability: 0.54,
        confidenceTier: "B",
      },
      total: {
        pick: "over",
        pickLabel: "Over 9.5",
        odds: -108,
        edgeScore: 0.09,
        modelProbability: 0.60,
        confidenceTier: "A",
      },
    },
    ...overrides,
  };
}

// ─── generateDailyParlays ─────────────────────────────────────────────────────

describe("generateDailyParlays", () => {
  it("returns empty array when fewer than 2 games with edge", () => {
    // A single game with no edge produces 0 candidates → empty
    const noEdgeGame = mockGame({
      gamePk: 1,
      predictions: {
        moneyLine: { pick: "home", pickLabel: "Home ML", odds: -110, edgeScore: 0.01, modelProbability: 0.50, confidenceTier: "D" },
        runLine: null,
        total: null,
      },
    });
    const result = generateDailyParlays([noEdgeGame], []);
    expect(result).toHaveLength(0);
  });

  it("returns 5 parlay types when enough games exist", () => {
    const games = Array.from({ length: 8 }, (_, i) => mockGame({ gamePk: i + 1 }));
    const result = generateDailyParlays(games, []);
    expect(result).toHaveLength(5);
    const types = result.map((p) => p.type);
    expect(types).toContain("power");
    expect(types).toContain("value");
    expect(types).toContain("lotto");
    expect(types).toContain("highvalue");
    expect(types).toContain("hrprop");
  });

  it("power parlay has 5-6 legs", () => {
    const games = Array.from({ length: 8 }, (_, i) => mockGame({ gamePk: i + 1 }));
    const result = generateDailyParlays(games, []);
    const power = result.find((p) => p.type === "power")!;
    expect(power.totalLegs).toBeGreaterThanOrEqual(5);
    expect(power.totalLegs).toBeLessThanOrEqual(6);
  });

  it("value parlay has 3-4 legs", () => {
    const games = Array.from({ length: 8 }, (_, i) => mockGame({ gamePk: i + 1 }));
    const result = generateDailyParlays(games, []);
    const value = result.find((p) => p.type === "value")!;
    expect(value.totalLegs).toBeGreaterThanOrEqual(3);
    expect(value.totalLegs).toBeLessThanOrEqual(4);
  });

  it("lotto parlay targets +4000 minimum odds", () => {
    const games = Array.from({ length: 12 }, (_, i) => mockGame({ gamePk: i + 1 }));
    const result = generateDailyParlays(games, []);
    const lotto = result.find((p) => p.type === "lotto")!;
    // With 12 games and -110 legs, we should reach +4000
    expect(lotto.combinedOdds).toBeGreaterThanOrEqual(4000);
  });

  it("highvalue parlay has 1-2 legs", () => {
    const games = Array.from({ length: 8 }, (_, i) => mockGame({ gamePk: i + 1 }));
    const result = generateDailyParlays(games, []);
    const hv = result.find((p) => p.type === "highvalue")!;
    expect(hv.totalLegs).toBeGreaterThanOrEqual(1);
    expect(hv.totalLegs).toBeLessThanOrEqual(2);
  });

  it("no parlay has duplicate games", () => {
    const games = Array.from({ length: 8 }, (_, i) => mockGame({ gamePk: i + 1 }));
    const result = generateDailyParlays(games, []);
    for (const parlay of result.filter((p) => p.type !== "hrprop")) {
      const gamePks = parlay.legs.map((l) => l.gamePk);
      const unique = new Set(gamePks);
      expect(unique.size).toBe(gamePks.length);
    }
  });

  it("each leg has reasoning text", () => {
    const games = Array.from({ length: 6 }, (_, i) => mockGame({ gamePk: i + 1 }));
    const result = generateDailyParlays(games, []);
    for (const parlay of result) {
      for (const leg of parlay.legs) {
        expect(leg.reasoning).toBeTruthy();
        expect(leg.reasoning.length).toBeGreaterThan(10);
      }
    }
  });

  it("each parlay has a reasoning string", () => {
    const games = Array.from({ length: 6 }, (_, i) => mockGame({ gamePk: i + 1 }));
    const result = generateDailyParlays(games, []);
    for (const parlay of result) {
      expect(parlay.reasoning).toBeTruthy();
      expect(parlay.reasoning.length).toBeGreaterThan(20);
    }
  });

  it("combinedOdds matches legs calculation", () => {
    const games = Array.from({ length: 6 }, (_, i) => mockGame({ gamePk: i + 1 }));
    const result = generateDailyParlays(games, []);
    for (const parlay of result) {
      if (parlay.legs.length === 0) continue;
      const expected = combineParlayOdds(parlay.legs.map((l) => l.odds));
      expect(parlay.combinedOdds).toBe(expected);
    }
  });

  it("value parlay includes prop leg when strong prop provided", () => {
    const games = Array.from({ length: 6 }, (_, i) => mockGame({ gamePk: i + 1 }));
    const props = [{
      eventId: 1, // match an existing gamePk so game lookup works
      playerName: "Aaron Judge",
      propType: "HR",
      pick: "over",
      line: 0.5,
      overOdds: -115,
      underOdds: +105,
      edgeScore: 0.12,
      confidenceTier: "A",
      homeTeam: "Yankees",
      awayTeam: "Red Sox",
      modelProjection: 0.62,
      reasoning: "Strong HR conditions",
    }];
    const result = generateDailyParlays(games, props);
    const value = result.find((p) => p.type === "value")!;
    const hasProp = value.legs.some((l) => l.market === "prop");
    expect(hasProp).toBe(true);
  });
});

// ─── analyzeLoss ──────────────────────────────────────────────────────────────

describe("analyzeLoss", () => {
  it("returns missedReason, dataSignals, improvementNote", () => {
    const result = analyzeLoss("power", [
      { market: "moneyline", pick: "home", reasoning: "Model edge +8%", actualOutcome: "away won 5-3" },
    ]);
    expect(result.missedReason).toBeTruthy();
    expect(result.dataSignals).toBeTruthy();
    expect(result.improvementNote).toBeTruthy();
  });

  it("moneyline loss triggers pitcher-scratch note", () => {
    const result = analyzeLoss("value", [
      { market: "moneyline", pick: "home", reasoning: "Ace pitcher matchup", actualOutcome: "away won" },
    ]);
    expect(result.improvementNote.toLowerCase()).toContain("pitcher");
  });

  it("total loss triggers weather/umpire recalibration note", () => {
    const result = analyzeLoss("power", [
      { market: "total", pick: "over", reasoning: "Wind blowing out", actualOutcome: "under 7-4" },
    ]);
    expect(result.improvementNote.toLowerCase()).toContain("total");
  });

  it("prop loss triggers Statcast note", () => {
    const result = analyzeLoss("value", [
      { market: "prop", pick: "over", reasoning: "HR conditions", actualOutcome: "no HR" },
    ]);
    expect(result.improvementNote.toLowerCase()).toContain("prop");
  });

  it("includes all lost legs in missedReason", () => {
    const result = analyzeLoss("lotto", [
      { market: "moneyline", pick: "home", reasoning: "Edge +9%", actualOutcome: "away won" },
      { market: "total", pick: "over", reasoning: "Wind out", actualOutcome: "under" },
    ]);
    expect(result.missedReason).toContain("MONEYLINE");
    expect(result.missedReason).toContain("TOTAL");
  });
});
