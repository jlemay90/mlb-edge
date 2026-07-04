import { describe, expect, it } from "vitest";
import { ApiResponseError, readApiJson } from "../client/apiClient";
import { replayStatusDetail, replayStatusLabel } from "../client/replaySummary";

describe("client API helpers", () => {
  it("turns non-JSON API responses into readable errors", async () => {
    const response = new Response("A server error occurred while loading schedule", {
      status: 502,
      statusText: "Bad Gateway",
    });

    await expect(readApiJson(response)).rejects.toMatchObject({
      name: "ApiResponseError",
      status: 502,
      message: "API returned 502 Bad Gateway instead of JSON: A server error occurred while loading schedule",
    } satisfies Partial<ApiResponseError>);
  });

  it("summarizes cached historical replay status for the Today screen", () => {
    const report = {
      status: "blocked",
      completedSeasonCount: 0,
      requiredSeasonCount: 5,
      summary: {
        totalPicks: 7589,
        roi: -0.0262,
        winRate: 0.4895,
      },
    };

    expect(replayStatusLabel(report)).toBe("cached");
    expect(replayStatusDetail(report)).toBe("7,589 scored picks, -2.6% ROI, 49.0% win rate");
  });
});
