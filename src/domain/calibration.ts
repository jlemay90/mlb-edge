import { DEFAULT_MODEL_CONFIG, type Market, type ModelConfig } from "./modelConfig.js";
import { type GradedPick, type PickGradeResult } from "./grading.js";
import { type Pick } from "./picks.js";

export type CalibrationPick = Omit<GradedPick, "result"> & {
  result: PickGradeResult;
  pick: Pick;
};

export type CalibrationBucket = {
  label: string;
  lowerBound: number;
  upperBound: number;
  count: number;
  wins: number;
  losses: number;
  averagePredictedProbability: number;
  actualHitRate: number;
  calibrationError: number;
  warning?: string;
};

export type ThresholdRecommendation = {
  market: Market;
  sampleSize: number;
  currentThreshold: number;
  proposedThreshold: number;
  adoptionEligible: boolean;
  reason: string;
};

const WARNING_SAMPLE_SIZE = 100;
const ADOPTION_SAMPLE_SIZE = 200;

export function buildCalibrationBuckets(picks: CalibrationPick[]): CalibrationBucket[] {
  const graded = picks.filter((pick) => pick.result === "win" || pick.result === "loss");
  const buckets = Array.from({ length: 10 }, (_, index) => {
    const lowerBound = index / 10;
    const upperBound = (index + 1) / 10;
    return {
      label: `${index * 10}-${index * 10 + 9}%`,
      lowerBound,
      upperBound,
      picks: [] as CalibrationPick[],
    };
  });

  for (const pick of graded) {
    const index = Math.min(9, Math.floor(pick.pick.modelProbability * 10));
    buckets[index]!.picks.push(pick);
  }

  return buckets
    .filter((bucket) => bucket.picks.length > 0)
    .map((bucket) => {
      const wins = bucket.picks.filter((pick) => pick.result === "win").length;
      const losses = bucket.picks.filter((pick) => pick.result === "loss").length;
      const averagePredictedProbability = average(bucket.picks.map((pick) => pick.pick.modelProbability));
      const actualHitRate = wins / (wins + losses);
      const calibrationError = averagePredictedProbability - actualHitRate;

      return {
        label: bucket.label,
        lowerBound: bucket.lowerBound,
        upperBound: bucket.upperBound,
        count: bucket.picks.length,
        wins,
        losses,
        averagePredictedProbability: roundTo(averagePredictedProbability, 4),
        actualHitRate: roundTo(actualHitRate, 4),
        calibrationError: roundTo(calibrationError, 4),
        warning:
          bucket.picks.length >= WARNING_SAMPLE_SIZE && calibrationError >= 0.08
            ? `Model is overconfident by ${(calibrationError * 100).toFixed(1)} percentage points in this bucket.`
            : undefined,
      };
    });
}

export function recommendThresholdChanges(
  picks: CalibrationPick[],
  config: ModelConfig = DEFAULT_MODEL_CONFIG
): ThresholdRecommendation[] {
  const markets = [...new Set(picks.map((pick) => pick.pick.market as Market))];

  return markets.map((market) => {
    const marketPicks = picks.filter(
      (pick) => pick.pick.market === market && (pick.result === "win" || pick.result === "loss")
    );
    const currentThreshold = config.thresholds[market];
    const lowEdgePicks = marketPicks.filter((pick) => pick.pick.edge <= currentThreshold + 0.015);
    const lowEdgeHitRate = hitRate(lowEdgePicks);
    const proposedThreshold =
      lowEdgePicks.length > 0 && lowEdgeHitRate < 0.48
        ? roundTo(currentThreshold + 0.01, 4)
        : currentThreshold;

    if (marketPicks.length < ADOPTION_SAMPLE_SIZE) {
      return {
        market,
        sampleSize: marketPicks.length,
        currentThreshold,
        proposedThreshold,
        adoptionEligible: false,
        reason: `Need at least ${ADOPTION_SAMPLE_SIZE} graded ${market} picks before adopting threshold changes.`,
      };
    }

    if (proposedThreshold > currentThreshold) {
      return {
        market,
        sampleSize: marketPicks.length,
        currentThreshold,
        proposedThreshold,
        adoptionEligible: true,
        reason: `Low-edge ${market} picks underperformed at ${(lowEdgeHitRate * 100).toFixed(1)}%; raise threshold before adoption.`,
      };
    }

    return {
      market,
      sampleSize: marketPicks.length,
      currentThreshold,
      proposedThreshold,
      adoptionEligible: false,
      reason: `${market} threshold has enough samples but no stricter candidate beat the current rule.`,
    };
  });
}

function hitRate(picks: CalibrationPick[]): number {
  const wins = picks.filter((pick) => pick.result === "win").length;
  const losses = picks.filter((pick) => pick.result === "loss").length;

  return wins + losses > 0 ? wins / (wins + losses) : 0;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
