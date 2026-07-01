import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL_CONFIG,
  getMarketThreshold,
  versionModelConfig,
} from "../domain/modelConfig";

describe("model config", () => {
  it("has explicit thresholds for each primary market", () => {
    expect(getMarketThreshold(DEFAULT_MODEL_CONFIG, "moneyline")).toBeGreaterThan(0);
    expect(getMarketThreshold(DEFAULT_MODEL_CONFIG, "runline")).toBeGreaterThan(0);
    expect(getMarketThreshold(DEFAULT_MODEL_CONFIG, "total")).toBeGreaterThan(0);
    expect(getMarketThreshold(DEFAULT_MODEL_CONFIG, "prop")).toBeGreaterThan(0);
  });

  it("has weights for the model signals we plan to learn from", () => {
    expect(DEFAULT_MODEL_CONFIG.weights.offense).toBeGreaterThan(0);
    expect(DEFAULT_MODEL_CONFIG.weights.starter).toBeGreaterThan(0);
    expect(DEFAULT_MODEL_CONFIG.weights.bullpen).toBeGreaterThan(0);
    expect(DEFAULT_MODEL_CONFIG.weights.park).toBeGreaterThan(0);
    expect(DEFAULT_MODEL_CONFIG.weights.weather).toBeGreaterThan(0);
    expect(DEFAULT_MODEL_CONFIG.weights.lineup).toBeGreaterThan(0);
    expect(DEFAULT_MODEL_CONFIG.weights.recentForm).toBeGreaterThan(0);
  });

  it("creates a new immutable config version with a changelog reason", () => {
    const next = versionModelConfig(DEFAULT_MODEL_CONFIG, {
      reason: "Raise total threshold after poor calibration",
      thresholds: { total: 0.045 },
    });

    expect(next.version).not.toBe(DEFAULT_MODEL_CONFIG.version);
    expect(next.thresholds.total).toBe(0.045);
    expect(DEFAULT_MODEL_CONFIG.thresholds.total).not.toBe(0.045);
    expect(next.changelog[0]).toContain("Raise total threshold");
  });

  it("rejects version changes without an evidence-backed reason", () => {
    expect(() =>
      versionModelConfig(DEFAULT_MODEL_CONFIG, {
        reason: " ",
        thresholds: { moneyline: 0.04 },
      })
    ).toThrow("reason");
  });
});

