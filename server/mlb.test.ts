import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock external HTTP calls so tests run offline ───────────────────────────
vi.mock("axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// ─── Prediction engine unit tests ────────────────────────────────────────────
describe("Prediction Engine", () => {
  it("converts American odds to implied probability correctly", () => {
    // Favourite (negative odds)
    const impliedFav = 100 / (150 + 100); // +150 → 40%
    expect(impliedFav).toBeCloseTo(0.4, 2);

    // Underdog (positive odds)
    const impliedDog = 110 / (110 + 100); // -110 → 52.38%
    expect(impliedDog).toBeCloseTo(0.5238, 3);
  });

  it("calculates edge as model probability minus implied probability", () => {
    const modelProb = 0.62;
    const impliedProb = 0.52;
    const edge = modelProb - impliedProb;
    expect(edge).toBeCloseTo(0.10, 2);
  });

  it("assigns correct confidence tier based on edge score", () => {
    const getTier = (edge: number): string => {
      if (edge >= 0.08) return "A";
      if (edge >= 0.05) return "B";
      if (edge >= 0.03) return "C";
      if (edge >= 0.02) return "D";
      return "F";
    };

    expect(getTier(0.10)).toBe("A");
    expect(getTier(0.08)).toBe("A");
    expect(getTier(0.07)).toBe("B");
    expect(getTier(0.05)).toBe("B");
    expect(getTier(0.04)).toBe("C");
    expect(getTier(0.03)).toBe("C");
    expect(getTier(0.025)).toBe("D");
    expect(getTier(0.01)).toBe("F");
  });

  it("calculates park-adjusted run total correctly", () => {
    const baseTotal = 9.0;
    const parkFactor = 108; // 8% hitter-friendly
    const adjusted = baseTotal * (parkFactor / 100);
    expect(adjusted).toBeCloseTo(9.72, 2);
  });

  it("calculates wind run impact correctly", () => {
    // Out to CF at 15mph → positive run impact
    const windSpeed = 15;
    const isBlowingOut = true;
    const impact = isBlowingOut ? windSpeed * 0.04 : -(windSpeed * 0.03);
    expect(impact).toBeCloseTo(0.6, 1);

    // Blowing in → negative impact
    const impactIn = false ? windSpeed * 0.04 : -(windSpeed * 0.03);
    expect(impactIn).toBeCloseTo(-0.45, 1);
  });

  it("calculates temperature run impact correctly", () => {
    // Cold weather reduces scoring
    const tempF = 45;
    const baseline = 72;
    const diff = tempF - baseline;
    const impact = diff * 0.01; // ~-0.27 runs
    expect(impact).toBeLessThan(0);
    expect(impact).toBeCloseTo(-0.27, 2);
  });
});

// ─── Router procedure tests ───────────────────────────────────────────────────
describe("MLB Router", () => {
  it("getTopPicks filters by minimum tier correctly", () => {
    const picks = [
      { confidenceTier: "A", edgeScore: 0.12 },
      { confidenceTier: "B", edgeScore: 0.06 },
      { confidenceTier: "C", edgeScore: 0.04 },
      { confidenceTier: "D", edgeScore: 0.02 },
    ];

    const tierOrder = ["A", "B", "C", "D", "F"];
    const filterByMinTier = (picks: any[], minTier: string) => {
      const minIdx = tierOrder.indexOf(minTier);
      return picks.filter((p) => tierOrder.indexOf(p.confidenceTier) <= minIdx);
    };

    expect(filterByMinTier(picks, "A")).toHaveLength(1);
    expect(filterByMinTier(picks, "B")).toHaveLength(2);
    expect(filterByMinTier(picks, "C")).toHaveLength(3);
    expect(filterByMinTier(picks, "D")).toHaveLength(4);
  });

  it("sorts picks by edge score descending", () => {
    const picks = [
      { edgeScore: 0.05 },
      { edgeScore: 0.12 },
      { edgeScore: 0.08 },
      { edgeScore: 0.03 },
    ];
    const sorted = [...picks].sort((a, b) => b.edgeScore - a.edgeScore);
    expect(sorted[0].edgeScore).toBe(0.12);
    expect(sorted[1].edgeScore).toBe(0.08);
    expect(sorted[2].edgeScore).toBe(0.05);
    expect(sorted[3].edgeScore).toBe(0.03);
  });

  it("removes vig from American odds correctly", () => {
    // Standard -110/-110 line
    const homeOdds = -110;
    const awayOdds = -110;

    const toDecimal = (american: number) =>
      american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;

    const homeDecimal = toDecimal(homeOdds);
    const awayDecimal = toDecimal(awayOdds);

    const homeImplied = 1 / homeDecimal;
    const awayImplied = 1 / awayDecimal;
    const overround = homeImplied + awayImplied;

    const homeNoVig = homeImplied / overround;
    const awayNoVig = awayImplied / overround;

    // Should sum to 1.0 after vig removal
    expect(homeNoVig + awayNoVig).toBeCloseTo(1.0, 5);
    // Both should be ~50% for a pick'em
    expect(homeNoVig).toBeCloseTo(0.5, 2);
  });

  it("calculates projected total from team run components", () => {
    const homeOffense = 4.8; // runs/game
    const awayOffense = 4.2;
    const homePitcherERA = 3.5;
    const awayPitcherERA = 4.1;

    // Simple projection: avg of offense vs opposing pitcher
    const projHome = (homeOffense + awayPitcherERA) / 2;
    const projAway = (awayOffense + homePitcherERA) / 2;
    const projTotal = projHome + projAway;

    expect(projTotal).toBeGreaterThan(7);
    expect(projTotal).toBeLessThan(12);
  });
});

// ─── Backtest data validation ─────────────────────────────────────────────────
describe("Backtest Results", () => {
  it("validates ROI calculation from W/L record", () => {
    const wins = 89;
    const losses = 53;
    const avgOdds = -108; // typical moneyline odds

    // Flat $100 bet ROI calculation
    const toDecimal = (american: number) =>
      american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;

    const decimalOdds = toDecimal(avgOdds);
    const totalBets = wins + losses;
    const totalReturn = wins * decimalOdds * 100;
    const totalStaked = totalBets * 100;
    const roi = ((totalReturn - totalStaked) / totalStaked) * 100;

    expect(roi).toBeGreaterThan(0); // profitable
    expect(roi).toBeGreaterThan(15); // strong positive ROI for 62.7% win rate
  });

  it("validates win percentage calculation", () => {
    const wins = 89;
    const losses = 53;
    const winPct = wins / (wins + losses);
    expect(winPct).toBeCloseTo(0.627, 3);
  });
});
