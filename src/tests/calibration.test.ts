import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_CONFIG } from "../domain/modelConfig";
import {
  buildCalibrationBuckets,
  recommendThresholdChanges,
  type CalibrationPick,
} from "../domain/calibration";
import { type Pick } from "../domain/picks";

function calibrationPick(
  result: CalibrationPick["result"],
  overrides: Partial<Pick> = {}
): CalibrationPick {
  const pick = {
    id: overrides.id ?? `${overrides.market ?? "moneyline"}:${Math.random()}`,
    gameId: overrides.gameId ?? "game-1",
    date: "2026-06-01",
    market: overrides.market ?? "moneyline",
    selection: overrides.selection ?? "home",
    label: overrides.label ?? "Home Club ML",
    odds: overrides.odds ?? -110,
    modelProbability: overrides.modelProbability ?? 0.55,
    impliedProbability: overrides.impliedProbability ?? 0.5,
    edge: overrides.edge ?? 0.04,
    confidenceTier: overrides.confidenceTier ?? "B",
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
  };
}

describe("calibration", () => {
  it("aggregates probability buckets with actual hit rate", () => {
    const buckets = buildCalibrationBuckets([
      calibrationPick("win", { modelProbability: 0.54 }),
      calibrationPick("loss", { modelProbability: 0.56 }),
      calibrationPick("win", { modelProbability: 0.64 }),
    ]);

    const fiftyBucket = buckets.find((bucket) => bucket.label === "50-59%")!;

    expect(fiftyBucket.count).toBe(2);
    expect(fiftyBucket.averagePredictedProbability).toBeCloseTo(0.55, 2);
    expect(fiftyBucket.actualHitRate).toBe(0.5);
  });

  it("detects overconfidence only when the bucket has enough samples", () => {
    const tooSmall = buildCalibrationBuckets(
      Array.from({ length: 99 }, (_, index) =>
        calibrationPick(index < 50 ? "win" : "loss", { modelProbability: 0.72 })
      )
    );
    const enough = buildCalibrationBuckets(
      Array.from({ length: 100 }, (_, index) =>
        calibrationPick(index < 50 ? "win" : "loss", { modelProbability: 0.72 })
      )
    );

    expect(tooSmall.find((bucket) => bucket.label === "70-79%")!.warning).toBeUndefined();
    expect(enough.find((bucket) => bucket.label === "70-79%")!.warning).toContain("overconfident");
  });

  it("gates threshold adoption until a market reaches the minimum sample size", () => {
    const recommendations = recommendThresholdChanges(
      Array.from({ length: 199 }, () =>
        calibrationPick("loss", { market: "moneyline", modelProbability: 0.56, edge: 0.031 })
      )
    );

    expect(recommendations[0]!.market).toBe("moneyline");
    expect(recommendations[0]!.adoptionEligible).toBe(false);
    expect(recommendations[0]!.reason).toContain("200");
  });

  it("recommends a stricter threshold when enough low-edge market picks underperform", () => {
    const recommendations = recommendThresholdChanges(
      Array.from({ length: 200 }, (_, index) =>
        calibrationPick(index < 80 ? "win" : "loss", {
          market: "moneyline",
          modelProbability: 0.56,
          edge: 0.031,
        })
      )
    );

    const moneyline = recommendations.find((recommendation) => recommendation.market === "moneyline")!;

    expect(moneyline.adoptionEligible).toBe(true);
    expect(moneyline.proposedThreshold).toBeGreaterThan(DEFAULT_MODEL_CONFIG.thresholds.moneyline);
    expect(moneyline.reason).toContain("underperformed");
  });
});
