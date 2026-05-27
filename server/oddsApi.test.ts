import { describe, it, expect } from "vitest";

describe("Odds API Key Validation", () => {
  it("should connect to The Odds API with the provided key", async () => {
    const apiKey = process.env.ODDS_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey?.length).toBeGreaterThan(10);

    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    const mlb = data.find((s: { key: string }) => s.key === "baseball_mlb");
    expect(mlb).toBeDefined();
  }, 15000);
});
