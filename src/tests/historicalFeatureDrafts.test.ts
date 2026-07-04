import { describe, expect, it } from "vitest";
import { buildHistoricalFeatureDraft } from "../server/historicalFeatureDrafts";
import { type MlbScheduledGame } from "../server/providers/mlbStats";
import { type OddsEvent } from "../server/providers/oddsApi";

function game(overrides: Partial<MlbScheduledGame> = {}): MlbScheduledGame {
  return {
    gameId: "game-1",
    gameDate: "2025-07-01T23:05:00Z",
    officialDate: "2025-07-01",
    status: "final",
    homeTeam: "New York Yankees",
    awayTeam: "Toronto Blue Jays",
    homeScore: 5,
    awayScore: 3,
    venue: "Yankee Stadium",
    venueId: "3313",
    ...overrides,
  };
}

function oddsEvent(overrides: Partial<OddsEvent> = {}): OddsEvent {
  return {
    id: "odds-event-1",
    commenceTime: "2025-07-01T23:05:00Z",
    homeTeam: "New York Yankees",
    awayTeam: "Toronto Blue Jays",
    bookmakers: [
      {
        key: "draftkings",
        title: "DraftKings",
        lastUpdate: "2025-07-01T20:55:00Z",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "New York Yankees", price: -145 },
              { name: "Toronto Blue Jays", price: 125 },
            ],
          },
          {
            key: "spreads",
            outcomes: [
              { name: "New York Yankees", price: 140, point: -1.5 },
              { name: "Toronto Blue Jays", price: -160, point: 1.5 },
            ],
          },
          {
            key: "totals",
            outcomes: [
              { name: "Over", price: -110, point: 8.5 },
              { name: "Under", price: -110, point: 8.5 },
            ],
          },
        ],
      },
      {
        key: "fanduel",
        title: "FanDuel",
        lastUpdate: "2025-07-01T20:56:00Z",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "New York Yankees", price: -155 },
              { name: "Toronto Blue Jays", price: 135 },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("historical feature drafts", () => {
  it("builds odds-derived feature fields from a cached historical odds event", () => {
    const draft = buildHistoricalFeatureDraft({
      game: game(),
      oddsEvents: [oddsEvent()],
      oddsSnapshotTime: "2025-07-01T21:00:00Z",
    });

    expect(draft?.featureSnapshot).toMatchObject({
      gameId: "game-1",
      date: "2025-07-01",
      homeTeam: "New York Yankees",
      awayTeam: "Toronto Blue Jays",
      venueName: "Yankee Stadium",
      venueId: "3313",
      homeMoneyline: -150,
      awayMoneyline: 130,
      runLine: -1.5,
      homeRunLineOdds: 140,
      awayRunLineOdds: -160,
      total: 8.5,
      overOdds: -110,
      underOdds: -110,
    });
    expect(draft?.source).toMatchObject({
      oddsEventId: "odds-event-1",
      oddsSnapshotTime: "2025-07-01T21:00:00Z",
      oddsMarkets: ["h2h", "spreads", "totals"],
    });
    expect(draft?.missingSignals).toEqual(
      expect.arrayContaining([
        "team offense",
        "starter pitching",
        "bullpen rest",
        "park factors",
        "weather",
        "confirmed lineups",
        "recent form",
      ])
    );
  });

  it("does not build a draft when the cached odds event cannot be matched to the game", () => {
    const draft = buildHistoricalFeatureDraft({
      game: game({ homeTeam: "Houston Astros" }),
      oddsEvents: [oddsEvent()],
      oddsSnapshotTime: "2025-07-01T21:00:00Z",
    });

    expect(draft).toBeUndefined();
  });

  it("merges derived pregame context into a historical feature draft", () => {
    const draft = buildHistoricalFeatureDraft({
      game: game(),
      oddsEvents: [oddsEvent()],
      oddsSnapshotTime: "2025-07-01T21:00:00Z",
      weatherRunImpact: 0.4,
      pregameContext: {
        homeWrcPlus: 118,
        awayWrcPlus: 92,
        homeBullpenRest: 80,
        awayBullpenRest: 45,
        homeRecentForm: 1.2,
        awayRecentForm: -0.6,
        parkRunFactor: 104,
        parkFactorSource: "Pregame venue scoring history: 30 prior games at Yankee Stadium",
      },
    });

    expect(draft?.featureSnapshot).toMatchObject({
      homeWrcPlus: 118,
      awayWrcPlus: 92,
      homeBullpenRest: 80,
      awayBullpenRest: 45,
      homeRecentForm: 1.2,
      awayRecentForm: -0.6,
      parkRunFactor: 104,
      weatherRunImpact: 0.4,
    });
    expect(draft?.missingSignals).not.toContain("team offense");
    expect(draft?.missingSignals).not.toContain("bullpen rest");
    expect(draft?.missingSignals).not.toContain("park factors");
    expect(draft?.missingSignals).not.toContain("weather");
    expect(draft?.missingSignals).not.toContain("recent form");
    expect(draft?.missingSignals).toEqual(expect.arrayContaining(["starter pitching", "confirmed lineups"]));
  });
});
