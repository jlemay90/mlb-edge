import { describe, expect, it } from "vitest";
import { sampleModelPreview } from "../domain/sampleData";

describe("sample preview data", () => {
  it("marks the five-season historical backtest as blocked until real replay data is imported", () => {
    expect(sampleModelPreview.historicalBacktest.seasons).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(sampleModelPreview.historicalBacktest.status).toBe("blocked");
    expect(sampleModelPreview.historicalBacktest.summary.totalPicks).toBe(0);
    expect(sampleModelPreview.historicalBacktest.canClaimHighSuccessRate).toBe(false);
  });
});
