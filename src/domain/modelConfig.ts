export type Market = "moneyline" | "runline" | "total" | "prop";

export type ModelWeights = {
  offense: number;
  starter: number;
  bullpen: number;
  park: number;
  weather: number;
  lineup: number;
  recentForm: number;
};

export type ModelConfig = {
  version: string;
  thresholds: Readonly<Record<Market, number>>;
  weights: Readonly<ModelWeights>;
  changelog: readonly string[];
};

export const DEFAULT_MODEL_CONFIG: ModelConfig = Object.freeze({
  version: "1.0.0",
  thresholds: Object.freeze({
    moneyline: 0.03,
    runline: 0.035,
    total: 0.035,
    prop: 0.04,
  }),
  weights: Object.freeze({
    offense: 0.28,
    starter: 0.24,
    bullpen: 0.14,
    park: 0.1,
    weather: 0.08,
    lineup: 0.08,
    recentForm: 0.08,
  }),
  changelog: Object.freeze(["Initial MLB Edge Lab model config"]),
});

export function getMarketThreshold(config: ModelConfig, market: Market): number {
  return config.thresholds[market];
}

export function versionModelConfig(
  config: ModelConfig,
  change: {
    reason: string;
    thresholds?: Partial<Record<Market, number>>;
    weights?: Partial<ModelWeights>;
  }
): ModelConfig {
  const reason = change.reason.trim();
  if (!reason) {
    throw new Error("Model config change requires an evidence-backed reason");
  }

  return {
    version: bumpPatchVersion(config.version),
    thresholds: {
      ...config.thresholds,
      ...change.thresholds,
    },
    weights: {
      ...config.weights,
      ...change.weights,
    },
    changelog: [`${new Date().toISOString()}: ${reason}`, ...config.changelog],
  };
}

function bumpPatchVersion(version: string): string {
  const [major, minor, patch] = version.split(".").map((part) => Number.parseInt(part, 10));
  if ([major, minor, patch].some((part) => Number.isNaN(part))) {
    return `${version}.1`;
  }

  return `${major}.${minor}.${patch + 1}`;
}
