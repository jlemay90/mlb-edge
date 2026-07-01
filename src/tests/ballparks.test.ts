import { describe, expect, it } from "vitest";
import { applyKnownBallparkContext } from "../domain/ballparks";
import { projectGame, type GameFeatures } from "../domain/projection";

function game(overrides: Partial<GameFeatures> = {}): GameFeatures {
  return {
    gameId: "ath-hou-20260701",
    date: "2026-07-01",
    homeTeam: "Oakland Athletics",
    awayTeam: "Houston Astros",
    venueName: "Oakland Coliseum",
    parkRunFactor: 94,
    homeWrcPlus: 100,
    awayWrcPlus: 100,
    homeStarterFip: 4.1,
    awayStarterFip: 4.1,
    homeBullpenRest: 60,
    awayBullpenRest: 60,
    weatherRunImpact: 0,
    ...overrides,
  };
}

describe("known ballpark context", () => {
  it("moves Athletics home games off stale Oakland Coliseum context in 2026", () => {
    const normalized = applyKnownBallparkContext(game());

    expect(normalized.venueName).toBe("Sutter Health Park");
    expect(normalized.venueId).toBe("2529");
    expect(normalized.parkRunFactor).toBe(128);
    expect(normalized.parkFactorSource).toContain("Baseball Savant");
  });

  it("recognizes common A's aliases during the temporary Sacramento seasons", () => {
    const normalized = applyKnownBallparkContext(game({ homeTeam: "A's", venueName: undefined }));

    expect(normalized.venueName).toBe("Sutter Health Park");
    expect(normalized.parkRunFactor).toBe(128);
  });

  it("does not overwrite an explicit special Athletics venue", () => {
    const normalized = applyKnownBallparkContext(
      game({
        venueName: "Las Vegas Ballpark",
        venueId: "4249",
        parkRunFactor: 111,
        parkFactorSource: "manual current venue override",
      })
    );

    expect(normalized.venueName).toBe("Las Vegas Ballpark");
    expect(normalized.venueId).toBe("4249");
    expect(normalized.parkRunFactor).toBe(111);
    expect(normalized.parkFactorSource).toBe("manual current venue override");
  });

  it("leaves Oakland-era Athletics games alone before the Sacramento move", () => {
    const normalized = applyKnownBallparkContext(game({ date: "2024-07-01" }));

    expect(normalized.venueName).toBe("Oakland Coliseum");
    expect(normalized.parkRunFactor).toBe(94);
  });

  it("stores normalized venue context on projections", () => {
    const projection = projectGame(game());

    expect(projection.features.venueName).toBe("Sutter Health Park");
    expect(projection.features.parkRunFactor).toBe(128);
  });
});
