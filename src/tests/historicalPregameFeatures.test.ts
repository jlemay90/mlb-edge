import { describe, expect, it } from "vitest";
import { buildHistoricalPregameContext, buildStarterPitchingContext } from "../server/historicalPregameFeatures";
import { type MlbPitcherGameLogEntry, type MlbScheduledGame } from "../server/providers/mlbStats";

function game(overrides: Partial<MlbScheduledGame>): MlbScheduledGame {
  return {
    gameId: overrides.gameId ?? "game",
    gameDate: overrides.gameDate ?? "2025-04-10T19:05:00Z",
    officialDate: overrides.officialDate ?? "2025-04-10",
    status: overrides.status ?? "final",
    homeTeam: overrides.homeTeam ?? "Home Club",
    awayTeam: overrides.awayTeam ?? "Away Club",
    homeScore: overrides.homeScore ?? 4,
    awayScore: overrides.awayScore ?? 3,
    venue: overrides.venue ?? "Test Park",
    venueId: overrides.venueId ?? "10",
    ...overrides,
  };
}

describe("historical pregame features", () => {
  it("derives offense, recent form, bullpen rest, and park factor from prior games only", () => {
    const target = game({
      gameId: "target",
      gameDate: "2025-04-10T19:05:00Z",
      officialDate: "2025-04-10",
      homeTeam: "Home Club",
      awayTeam: "Away Club",
      venue: "Test Park",
      venueId: "10",
    });
    const context = buildHistoricalPregameContext({
      game: target,
      games: [
        game({
          gameId: "home-1",
          gameDate: "2025-04-01T19:05:00Z",
          officialDate: "2025-04-01",
          homeTeam: "Home Club",
          awayTeam: "Other A",
          homeScore: 8,
          awayScore: 4,
        }),
        game({
          gameId: "home-2",
          gameDate: "2025-04-03T19:05:00Z",
          officialDate: "2025-04-03",
          homeTeam: "Other B",
          awayTeam: "Home Club",
          homeScore: 3,
          awayScore: 7,
        }),
        game({
          gameId: "away-1",
          gameDate: "2025-04-01T20:05:00Z",
          officialDate: "2025-04-01",
          homeTeam: "Away Club",
          awayTeam: "Other C",
          homeScore: 2,
          awayScore: 4,
          venue: "Other Park",
          venueId: "11",
        }),
        game({
          gameId: "away-2",
          gameDate: "2025-04-03T20:05:00Z",
          officialDate: "2025-04-03",
          homeTeam: "Other D",
          awayTeam: "Away Club",
          homeScore: 5,
          awayScore: 1,
          venue: "Other Park",
          venueId: "11",
        }),
        game({
          gameId: "future",
          gameDate: "2025-04-11T19:05:00Z",
          officialDate: "2025-04-11",
          homeTeam: "Home Club",
          awayTeam: "Away Club",
          homeScore: 30,
          awayScore: 0,
        }),
      ],
      minTeamGames: 2,
      minVenueGames: 2,
    });

    expect(context).toMatchObject({
      homeWrcPlus: 140,
      awayWrcPlus: 65,
      homeRecentForm: 3,
      awayRecentForm: -3,
      homeBullpenRest: 85,
      awayBullpenRest: 85,
      parkRunFactor: 125,
      parkFactorSource: "Pregame venue scoring history: 2 prior games at Test Park",
    });
  });

  it("leaves features absent when there is not enough pregame sample", () => {
    const target = game({
      gameId: "target",
      gameDate: "2025-04-02T19:05:00Z",
      officialDate: "2025-04-02",
      homeTeam: "Home Club",
      awayTeam: "Away Club",
    });

    const context = buildHistoricalPregameContext({
      game: target,
      games: [
        game({
          gameId: "home-1",
          gameDate: "2025-04-01T19:05:00Z",
          officialDate: "2025-04-01",
          homeTeam: "Home Club",
          awayTeam: "Other A",
          homeScore: 8,
          awayScore: 4,
        }),
      ],
      minTeamGames: 2,
      minVenueGames: 2,
    });

    expect(context.homeWrcPlus).toBeUndefined();
    expect(context.awayWrcPlus).toBeUndefined();
    expect(context.homeRecentForm).toBeUndefined();
    expect(context.awayRecentForm).toBeUndefined();
    expect(context.parkRunFactor).toBeUndefined();
    expect(context.homeBullpenRest).toBe(48);
  });

  it("derives starter FIP proxy from prior starts only", () => {
    const target = game({
      gameId: "target",
      gameDate: "2025-04-20T19:05:00Z",
      officialDate: "2025-04-20",
      homeProbablePitcherId: 101,
      awayProbablePitcherId: 202,
    });

    const context = buildStarterPitchingContext({
      game: target,
      pitcherLogsById: new Map<number, MlbPitcherGameLogEntry[]>([
        [
          101,
          [
            pitcherLog({
              playerId: 101,
              date: "2025-04-01",
              outs: 18,
              homeRuns: 1,
              baseOnBalls: 2,
              hitByPitch: 1,
              strikeOuts: 6,
            }),
            pitcherLog({
              playerId: 101,
              date: "2025-04-10",
              outs: 18,
              homeRuns: 0,
              baseOnBalls: 1,
              hitByPitch: 0,
              strikeOuts: 8,
            }),
            pitcherLog({
              playerId: 101,
              date: "2025-04-20",
              outs: 27,
              homeRuns: 9,
              baseOnBalls: 9,
              hitByPitch: 9,
              strikeOuts: 0,
            }),
          ],
        ],
        [
          202,
          [
            pitcherLog({
              playerId: 202,
              date: "2025-04-02",
              outs: 15,
              homeRuns: 2,
              baseOnBalls: 3,
              hitByPitch: 0,
              strikeOuts: 4,
            }),
            pitcherLog({
              playerId: 202,
              date: "2025-04-11",
              outs: 15,
              homeRuns: 1,
              baseOnBalls: 2,
              hitByPitch: 1,
              strikeOuts: 5,
            }),
          ],
        ],
      ]),
      minStarterStarts: 2,
    });

    expect(context.homeStarterFip).toBe(2.85);
    expect(context.awayStarterFip).toBe(7);
  });

  it("leaves starter FIP absent without a pitcher id or enough prior starts", () => {
    const context = buildStarterPitchingContext({
      game: game({
        gameId: "target",
        gameDate: "2025-04-20T19:05:00Z",
        officialDate: "2025-04-20",
        homeProbablePitcherId: 101,
      }),
      pitcherLogsById: new Map([[101, [pitcherLog({ playerId: 101, date: "2025-04-01" })]]]),
      minStarterStarts: 2,
    });

    expect(context.homeStarterFip).toBeUndefined();
    expect(context.awayStarterFip).toBeUndefined();
  });
});

function pitcherLog(overrides: Partial<MlbPitcherGameLogEntry>): MlbPitcherGameLogEntry {
  return {
    playerId: overrides.playerId ?? 1,
    playerName: overrides.playerName ?? "Pitcher",
    season: overrides.season ?? 2025,
    gamePk: overrides.gamePk ?? 1,
    date: overrides.date ?? "2025-04-01",
    gamesStarted: overrides.gamesStarted ?? 1,
    outs: overrides.outs ?? 15,
    inningsPitched: overrides.inningsPitched ?? "5.0",
    homeRuns: overrides.homeRuns ?? 0,
    strikeOuts: overrides.strikeOuts ?? 5,
    baseOnBalls: overrides.baseOnBalls ?? 1,
    hitByPitch: overrides.hitByPitch ?? 0,
    earnedRuns: overrides.earnedRuns ?? 2,
  };
}
