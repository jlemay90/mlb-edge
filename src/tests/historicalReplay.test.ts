import { describe, expect, it } from "vitest";
import { buildHistoricalSeasonReplay, type HistoricalGameReplayInput } from "../domain/historicalReplay";
import { type GameFeatures } from "../domain/projection";

function features(overrides: Partial<GameFeatures> = {}): GameFeatures {
  return {
    gameId: "game-1",
    date: "2025-07-01",
    homeTeam: "Home Club",
    awayTeam: "Away Club",
    homeMoneyline: -105,
    awayMoneyline: -105,
    total: 8,
    overOdds: -110,
    underOdds: -110,
    runLine: -1.5,
    homeRunLineOdds: 155,
    awayRunLineOdds: -180,
    homeWrcPlus: 132,
    awayWrcPlus: 84,
    homeStarterFip: 3.05,
    awayStarterFip: 5.25,
    homeBullpenRest: 82,
    awayBullpenRest: 42,
    parkRunFactor: 106,
    weatherRunImpact: 0.4,
    homeLineupConfirmed: true,
    awayLineupConfirmed: false,
    homeRecentForm: 1.4,
    awayRecentForm: -0.8,
    ...overrides,
  };
}

function completeGame(overrides: Partial<HistoricalGameReplayInput> = {}): HistoricalGameReplayInput {
  const snapshot = features(overrides.featureSnapshot);

  return {
    date: snapshot.date,
    gameId: snapshot.gameId,
    featureSnapshot: snapshot,
    finalResult: {
      gameId: snapshot.gameId,
      status: "final",
      homeTeam: snapshot.homeTeam,
      awayTeam: snapshot.awayTeam,
      homeScore: 7,
      awayScore: 2,
    },
    oddsSnapshotAvailable: true,
    weatherSnapshotAvailable: true,
    parkFactorAvailable: true,
    ...overrides,
  };
}

describe("historical replay assembly", () => {
  it("builds backtest slates from complete historical game snapshots", () => {
    const replay = buildHistoricalSeasonReplay({
      season: 2025,
      games: [completeGame()],
    });

    expect(replay.coverage).toMatchObject({
      scheduledGames: 1,
      finalResults: 1,
      oddsSnapshots: 1,
      weatherSnapshots: 1,
      parkFactors: 1,
      featureSnapshots: 1,
      missingSignals: [],
      blockers: [],
    });
    expect(replay.slates).toHaveLength(1);
    expect(replay.slates[0]!.date).toBe("2025-07-01");
    expect(replay.slates[0]!.picks.length).toBeGreaterThan(0);
    expect(replay.slates[0]!.picks[0]!.actualScore).toContain("Home Club 7");
  });

  it("counts missing provider signals without fabricating picks for incomplete games", () => {
    const replay = buildHistoricalSeasonReplay({
      season: 2025,
      games: [
        completeGame(),
        {
          date: "2025-07-02",
          gameId: "missing-game",
        },
      ],
    });

    expect(replay.coverage.scheduledGames).toBe(2);
    expect(replay.coverage.finalResults).toBe(1);
    expect(replay.coverage.oddsSnapshots).toBe(1);
    expect(replay.coverage.weatherSnapshots).toBe(1);
    expect(replay.coverage.parkFactors).toBe(1);
    expect(replay.coverage.featureSnapshots).toBe(1);
    expect(replay.coverage.missingSignals).toEqual(
      expect.arrayContaining(["historical odds", "final results", "weather", "park factors", "feature snapshots"])
    );
    expect(replay.coverage.blockers).toContain("1 game is missing imported feature snapshots.");
    expect(replay.slates).toHaveLength(1);
    expect(replay.slates[0]!.date).toBe("2025-07-01");
  });

  it("requires complete model inputs before replaying a historical feature snapshot", () => {
    const snapshot = features({ homeWrcPlus: undefined });
    const replay = buildHistoricalSeasonReplay({
      season: 2025,
      games: [
        {
          date: snapshot.date,
          gameId: snapshot.gameId,
          featureSnapshot: snapshot,
          finalResult: {
            gameId: snapshot.gameId,
            status: "final",
            homeTeam: snapshot.homeTeam,
            awayTeam: snapshot.awayTeam,
            homeScore: 7,
            awayScore: 2,
          },
          oddsSnapshotAvailable: true,
          weatherSnapshotAvailable: true,
          parkFactorAvailable: true,
        },
      ],
    });

    expect(replay.coverage.featureSnapshots).toBe(0);
    expect(replay.coverage.missingSignals).toContain("feature snapshots");
    expect(replay.coverage.blockers).toContain("1 game is missing imported feature snapshots.");
    expect(replay.slates).toHaveLength(0);
  });
});
