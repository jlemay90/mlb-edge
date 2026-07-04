import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildHistoricalImportReport, buildOddsCacheManifest } from "../server/historicalImport";
import { type FetchLike } from "../server/providers/mlbStats";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("historical import", () => {
  it("defaults to every completed season supported by historical MLB odds", async () => {
    const report = await buildHistoricalImportReport({
      asOfDateIso: "2026-07-01",
      fetchImpl: async () => jsonResponse(scheduleBody()),
    });

    expect(report.seasons).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  });

  it("continues after unavailable odds snapshots until the requested usable snapshots are cached", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    const apiCallLedgerPath = tempLedgerPath();
    tempDirs.push(cacheDir);
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      if (url.includes("statsapi.mlb.com")) {
        return jsonResponse(scheduleBody());
      }

      if (url.includes("date=2021-04-01T15%3A00%3A00Z")) {
        return jsonResponse({ message: "snapshot unavailable" }, 422);
      }

      return jsonResponse({
        timestamp: "2021-04-15T15:55:00Z",
        data: [
          {
            id: "odds-1",
            commence_time: "2021-04-15T17:05:00Z",
            home_team: "Home Club",
            away_team: "Away Club",
            bookmakers: [],
          },
        ],
      });
    };

    const report = await buildHistoricalImportReport({
      seasons: [2021],
      oddsApiKey: "odds-secret",
      maxOddsSnapshots: 1,
      cacheDir,
      apiCallLedgerPath,
      fetchImpl,
    });

    const oddsCalls = calls.filter((url) => url.includes("api.the-odds-api.com"));
    expect(oddsCalls).toHaveLength(2);
    expect(oddsCalls.every((url) => !url.includes(".000Z"))).toBe(true);
    expect(report.totals.oddsSnapshotsChecked).toBe(1);
    expect(report.totals.oddsEventsSeen).toBe(1);
    expect(report.seasonReports[0]!.nextOddsSnapshotTimes).not.toContain("2021-04-01T15:00:00Z");
  });

  it("records paid historical odds calls in a secret-free ledger with provider usage", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    const ledgerDir = mkdtempSync(join(tmpdir(), "mlb-edge-ledger-"));
    tempDirs.push(cacheDir);
    tempDirs.push(ledgerDir);
    const apiCallLedgerPath = join(ledgerDir, "api-calls.jsonl");
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("statsapi.mlb.com")) {
        return jsonResponse(scheduleBody());
      }

      return jsonResponse(
        {
          timestamp: "2021-04-01T14:55:00Z",
          data: [
            {
              id: "odds-1",
              commence_time: "2021-04-01T17:05:00Z",
              home_team: "Home Club",
              away_team: "Away Club",
              bookmakers: [
                {
                  key: "draftkings",
                  title: "DraftKings",
                  markets: [
                    { key: "h2h", outcomes: [] },
                    { key: "spreads", outcomes: [] },
                    { key: "totals", outcomes: [] },
                  ],
                },
              ],
            },
          ],
        },
        200,
        {
          "x-requests-last": "3",
          "x-requests-used": "20003",
          "x-requests-remaining": "29997",
        }
      );
    };

    const report = await buildHistoricalImportReport({
      seasons: [2021],
      oddsApiKey: "odds-secret",
      maxOddsSnapshots: 1,
      maxOddsApiCredits: 30000,
      cacheDir,
      apiCallLedgerPath,
      fetchImpl,
    });

    const ledgerText = readFileSync(apiCallLedgerPath, "utf8");
    const entries = ledgerText
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      provider: "the-odds-api",
      endpoint: "historical-mlb-odds",
      season: 2021,
      isoTimestamp: "2021-04-01T15:00:00Z",
      markets: ["h2h", "spreads", "totals"],
      status: "ok",
      eventCount: 1,
      creditsSpent: 3,
      requestUsage: {
        requestsLast: "3",
        requestsUsed: "20003",
        requestsRemaining: "29997",
      },
    });
    expect(ledgerText).not.toContain("odds-secret");
    expect(report.apiCallLedgerPath).toBe(apiCallLedgerPath);
    expect(report.maxOddsApiCredits).toBe(30000);
    expect(report.totals.oddsApiRequestsMade).toBe(1);
    expect(report.totals.oddsApiCreditsSpent).toBe(3);
  });

  it("does not spend Odds API credits when the remaining budget cannot cover a full-market request", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    const ledgerDir = mkdtempSync(join(tmpdir(), "mlb-edge-ledger-"));
    tempDirs.push(cacheDir);
    tempDirs.push(ledgerDir);
    const apiCallLedgerPath = join(ledgerDir, "api-calls.jsonl");
    const oddsCalls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("statsapi.mlb.com")) {
        return jsonResponse(scheduleBody());
      }

      oddsCalls.push(url);
      return jsonResponse({ data: [] });
    };

    const report = await buildHistoricalImportReport({
      seasons: [2021],
      oddsApiKey: "odds-secret",
      maxOddsSnapshots: 1,
      maxOddsApiCredits: 2,
      cacheDir,
      apiCallLedgerPath,
      fetchImpl,
    });

    expect(oddsCalls).toHaveLength(0);
    expect(existsSync(apiCallLedgerPath)).toBe(false);
    expect(report.totals.oddsSnapshotsChecked).toBe(0);
    expect(report.totals.oddsApiRequestsMade).toBe(0);
    expect(report.totals.oddsApiCreditsSpent).toBe(0);
    expect(report.seasonReports[0]!.nextOddsSnapshotTimes).toContain("2021-04-01T15:00:00Z");
  });

  it("falls back to moneyline-only odds when older snapshots reject full markets", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    const apiCallLedgerPath = tempLedgerPath();
    tempDirs.push(cacheDir);
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      if (url.includes("statsapi.mlb.com")) {
        return jsonResponse(scheduleBody());
      }

      if (url.includes("markets=h2h%2Cspreads%2Ctotals")) {
        return jsonResponse({ message: "market unavailable" }, 401);
      }

      return jsonResponse({
        timestamp: "2021-04-01T14:55:00Z",
        data: [
          {
            id: "odds-1",
            commence_time: "2021-04-01T17:05:00Z",
            home_team: "Home Club",
            away_team: "Away Club",
            bookmakers: [
              {
                key: "draftkings",
                title: "DraftKings",
                markets: [{ key: "h2h", outcomes: [] }],
              },
            ],
          },
        ],
      });
    };

    const report = await buildHistoricalImportReport({
      seasons: [2021],
      oddsApiKey: "odds-secret",
      maxOddsSnapshots: 1,
      cacheDir,
      apiCallLedgerPath,
      fetchImpl,
    });

    const oddsCalls = calls.filter((url) => url.includes("api.the-odds-api.com"));
    expect(oddsCalls).toHaveLength(2);
    expect(report.totals.oddsSnapshotsChecked).toBe(1);
    expect(report.totals.oddsSnapshotsFullMarket).toBe(0);
    expect(report.totals.oddsSnapshotsMoneylineOnly).toBe(1);
    expect(report.blockers.join(" ")).toContain("moneyline-only");
  });

  it("counts a full-market-to-h2h fallback as one moneyline-only snapshot", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    const apiCallLedgerPath = tempLedgerPath();
    tempDirs.push(cacheDir);
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("statsapi.mlb.com")) {
        return jsonResponse(scheduleBody());
      }

      if (url.includes("markets=h2h%2Cspreads%2Ctotals")) {
        return jsonResponse({ message: "market unavailable" }, 401);
      }

      return jsonResponse({
        timestamp: "2021-04-01T14:55:00Z",
        data: [
          {
            id: "odds-1",
            commence_time: "2021-04-01T17:05:00Z",
            home_team: "Home Club",
            away_team: "Away Club",
            bookmakers: [
              {
                key: "draftkings",
                title: "DraftKings",
                markets: [{ key: "h2h", outcomes: [] }],
              },
            ],
          },
        ],
      });
    };

    const report = await buildHistoricalImportReport({
      seasons: [2021],
      oddsApiKey: "odds-secret",
      maxOddsSnapshots: 1,
      cacheDir,
      apiCallLedgerPath,
      fetchImpl,
    });

    expect(report.totals.oddsSnapshotsChecked).toBe(1);
    expect(report.totals.oddsSnapshotsMoneylineOnly).toBe(1);
  });

  it("can import moneyline-only snapshots without requesting spread and total markets", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    const apiCallLedgerPath = tempLedgerPath();
    tempDirs.push(cacheDir);
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      if (url.includes("statsapi.mlb.com")) {
        return jsonResponse(scheduleBody());
      }

      return jsonResponse({
        timestamp: "2021-04-01T14:55:00Z",
        data: [
          {
            id: "odds-1",
            commence_time: "2021-04-01T17:05:00Z",
            home_team: "Home Club",
            away_team: "Away Club",
            bookmakers: [
              {
                key: "draftkings",
                title: "DraftKings",
                markets: [{ key: "h2h", outcomes: [] }],
              },
            ],
          },
        ],
      });
    };

    const report = await buildHistoricalImportReport({
      seasons: [2021],
      oddsApiKey: "odds-secret",
      maxOddsSnapshots: 1,
      cacheDir,
      apiCallLedgerPath,
      markets: ["h2h"],
      fetchImpl,
    });

    const oddsCalls = calls.filter((url) => url.includes("api.the-odds-api.com"));
    expect(oddsCalls).toHaveLength(1);
    expect(oddsCalls[0]).toContain("markets=h2h");
    expect(oddsCalls[0]).not.toContain("spreads");
    expect(report.requestedMarkets).toEqual(["h2h"]);
    expect(report.totals.oddsSnapshotsChecked).toBe(1);
    expect(report.totals.oddsSnapshotsFullMarket).toBe(0);
    expect(report.totals.oddsSnapshotsMoneylineOnly).toBe(1);
  });

  it("counts feature snapshot candidates from games with final results, venue, and cached odds", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    tempDirs.push(cacheDir);
    const seasonCacheDir = join(cacheDir, "2021");
    mkdirSync(seasonCacheDir, { recursive: true });
    writeFileSync(
      join(seasonCacheDir, "2021-04-01T15-00-00Z.json"),
      JSON.stringify({
        isoTimestamp: "2021-04-01T15:00:00Z",
        markets: ["h2h", "spreads", "totals"],
        events: [
          {
            homeTeam: "Home Club",
            awayTeam: "Away Club",
            bookmakers: [],
          },
        ],
      })
    );

    const report = await buildHistoricalImportReport({
      seasons: [2021],
      oddsApiKey: "odds-secret",
      maxOddsSnapshots: 0,
      maxWeatherSnapshots: 1,
      cacheDir,
      fetchImpl: async (url) => {
        if (url.includes("archive-api.open-meteo.com")) {
          throw new Error("Weather should not be requested for unmatched odds events");
        }

        return jsonResponse(scheduleBody());
      },
    });

    expect(report.totals.featureSnapshotCandidates).toBe(1);
    expect(report.totals.featureDrafts).toBe(1);
    expect(report.totals.featureDraftMissingSignals["team offense"]).toBe(1);
    expect(report.totals.featureDraftMissingSignals["starter pitching"]).toBe(1);
    expect(report.totals.featureDraftMissingSignals.weather).toBe(1);
    expect(report.seasonReports[0]!.featureSnapshotCandidates).toBe(1);
    expect(report.seasonReports[0]!.featureDrafts).toBe(1);
    expect(report.seasonReports[0]!.featureDraftMissingSignals["park factors"]).toBe(1);
  });

  it("fills historical weather on matched feature drafts when venue coordinates and archive data are available", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    const weatherCacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-weather-"));
    tempDirs.push(cacheDir);
    tempDirs.push(weatherCacheDir);
    const seasonCacheDir = join(cacheDir, "2021");
    mkdirSync(seasonCacheDir, { recursive: true });
    writeFileSync(
      join(seasonCacheDir, "2021-04-01T15-00-00Z.json"),
      JSON.stringify({
        isoTimestamp: "2021-04-01T15:00:00Z",
        markets: ["h2h", "spreads", "totals"],
        events: [
          {
            id: "odds-home-away",
            commence_time: "2021-04-01T17:05:00Z",
            home_team: "Home Club",
            away_team: "Away Club",
            bookmakers: [],
          },
        ],
      })
    );

    const calls: string[] = [];
    const report = await buildHistoricalImportReport({
      seasons: [2021],
      oddsApiKey: "odds-secret",
      maxOddsSnapshots: 0,
      maxWeatherSnapshots: 1,
      cacheDir,
      weatherCacheDir,
      fetchImpl: async (url) => {
        calls.push(url);
        if (url.includes("archive-api.open-meteo.com")) {
          return jsonResponse({
            hourly: {
              time: ["2021-04-01T17:00"],
              temperature_2m: [82],
              wind_speed_10m: [12],
              wind_direction_10m: [255],
            },
          });
        }

        return jsonResponse(scheduleBody());
      },
    });

    expect(calls.some((url) => url.includes("archive-api.open-meteo.com"))).toBe(true);
    expect(report.totals.weatherSnapshotsChecked).toBe(1);
    expect(report.totals.weatherSnapshotsCached).toBe(1);
    expect(report.totals.featureDrafts).toBe(1);
    expect(report.totals.featureDraftMissingSignals.weather).toBeUndefined();
    expect(report.totals.featureDraftMissingSignals["team offense"]).toBe(1);
  });

  it("fills historical weather for every matched draft when weather limit is unlimited", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    const weatherCacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-weather-"));
    tempDirs.push(cacheDir);
    tempDirs.push(weatherCacheDir);
    const seasonCacheDir = join(cacheDir, "2021");
    mkdirSync(seasonCacheDir, { recursive: true });
    for (const isoTimestamp of ["2021-04-01T15:00:00Z", "2021-04-15T16:00:00Z"]) {
      writeFileSync(
        join(seasonCacheDir, `${isoTimestamp.replace(/[:.]/g, "-")}.json`),
        JSON.stringify({
          isoTimestamp,
          markets: ["h2h", "spreads", "totals"],
          events: [
            {
              id: `odds-${isoTimestamp}`,
              commence_time: isoTimestamp === "2021-04-01T15:00:00Z" ? "2021-04-01T17:05:00Z" : "2021-04-15T18:00:00Z",
              home_team: "Home Club",
              away_team: "Away Club",
              bookmakers: [],
            },
          ],
        })
      );
    }

    const report = await buildHistoricalImportReport({
      seasons: [2021],
      oddsApiKey: "odds-secret",
      maxOddsSnapshots: 0,
      maxWeatherSnapshots: null,
      cacheDir,
      weatherCacheDir,
      fetchImpl: async (url) => {
        if (url.includes("archive-api.open-meteo.com")) {
          return jsonResponse({
            hourly: {
              time: ["2021-04-01T17:00", "2021-04-15T18:00"],
              temperature_2m: [82, 70],
              wind_speed_10m: [12, 4],
              wind_direction_10m: [255, 120],
            },
          });
        }

        return jsonResponse(scheduleBody());
      },
    });

    expect(report.maxWeatherSnapshots).toBeNull();
    expect(report.totals.featureDrafts).toBe(2);
    expect(report.totals.weatherSnapshotsChecked).toBe(2);
    expect(report.totals.weatherSnapshotsCached).toBe(2);
    expect(report.totals.featureDraftMissingSignals.weather).toBeUndefined();
  });

  it("fills starter pitching from cached MLB pitcher game logs", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    const pitcherLogCacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-pitchers-"));
    tempDirs.push(cacheDir);
    tempDirs.push(pitcherLogCacheDir);
    const seasonCacheDir = join(cacheDir, "2021");
    mkdirSync(seasonCacheDir, { recursive: true });
    writeFileSync(
      join(seasonCacheDir, "2021-04-15T16-00-00Z.json"),
      JSON.stringify({
        isoTimestamp: "2021-04-15T16:00:00Z",
        markets: ["h2h", "spreads", "totals"],
        events: [
          {
            id: "odds-home-away",
            commence_time: "2021-04-15T18:00:00Z",
            home_team: "Home Club",
            away_team: "Away Club",
            bookmakers: [],
          },
        ],
      })
    );
    writePitcherCache(pitcherLogCacheDir, 2021, 101, [
      pitcherLog({ playerId: 101, date: "2021-04-01", strikeOuts: 6, baseOnBalls: 1, homeRuns: 1 }),
      pitcherLog({ playerId: 101, date: "2021-04-06", strikeOuts: 7, baseOnBalls: 2, homeRuns: 0 }),
      pitcherLog({ playerId: 101, date: "2021-04-11", strikeOuts: 5, baseOnBalls: 1, homeRuns: 1 }),
    ]);
    writePitcherCache(pitcherLogCacheDir, 2021, 202, [
      pitcherLog({ playerId: 202, date: "2021-04-01", strikeOuts: 4, baseOnBalls: 2, homeRuns: 2 }),
      pitcherLog({ playerId: 202, date: "2021-04-06", strikeOuts: 5, baseOnBalls: 1, homeRuns: 1 }),
      pitcherLog({ playerId: 202, date: "2021-04-11", strikeOuts: 3, baseOnBalls: 3, homeRuns: 1 }),
    ]);

    const report = await buildHistoricalImportReport({
      seasons: [2021],
      oddsApiKey: "odds-secret",
      maxOddsSnapshots: 0,
      maxPitcherLogRequests: 0,
      cacheDir,
      pitcherLogCacheDir,
      fetchImpl: async (url) => {
        if (url.includes("/people/")) {
          throw new Error("Pitcher logs should come from cache");
        }

        return jsonResponse(scheduleBody());
      },
    });

    expect(report.totals.pitcherLogsCached).toBe(2);
    expect(report.totals.pitcherLogsChecked).toBe(0);
    expect(report.totals.featureDrafts).toBe(1);
    expect(report.totals.featureDraftMissingSignals["starter pitching"]).toBeUndefined();
  });

  it("does not count feature snapshot candidates when the cached odds event is for another game", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    const weatherCacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-weather-"));
    tempDirs.push(cacheDir);
    tempDirs.push(weatherCacheDir);
    const seasonCacheDir = join(cacheDir, "2021");
    mkdirSync(seasonCacheDir, { recursive: true });
    writeFileSync(
      join(seasonCacheDir, "2021-04-01T15-00-00Z.json"),
      JSON.stringify({
        isoTimestamp: "2021-04-01T15:00:00Z",
        markets: ["h2h", "spreads", "totals"],
        events: [
          {
            id: "odds-other-game",
            commence_time: "2021-04-01T17:05:00Z",
            home_team: "Other Home",
            away_team: "Other Away",
            bookmakers: [],
          },
        ],
      })
    );

    const report = await buildHistoricalImportReport({
      seasons: [2021],
      oddsApiKey: "odds-secret",
      maxOddsSnapshots: 0,
      maxWeatherSnapshots: 1,
      cacheDir,
      weatherCacheDir,
      fetchImpl: async (url) => {
        if (url.includes("archive-api.open-meteo.com")) {
          throw new Error("Weather should not be requested for unmatched odds events");
        }

        return jsonResponse(scheduleBody());
      },
    });

    expect(report.totals.featureSnapshotCandidates).toBe(0);
    expect(report.totals.featureDrafts).toBe(0);
    expect(report.totals.weatherSnapshotsChecked).toBe(0);
    expect(report.totals.weatherSnapshotsFailed).toBe(0);
    expect(report.totals.featureDraftMissingSignals["team offense"]).toBeUndefined();
    expect(report.seasonReports[0]!.featureSnapshotCandidates).toBe(0);
    expect(report.seasonReports[0]!.featureDrafts).toBe(0);
  });

  it("builds a named manifest of reusable historical odds cache files", () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "mlb-edge-odds-"));
    tempDirs.push(cacheDir);
    const seasonCacheDir = join(cacheDir, "2021");
    mkdirSync(seasonCacheDir, { recursive: true });
    const cachePath = join(seasonCacheDir, "2021-04-01T15-00-00Z.json");
    writeFileSync(
      cachePath,
      JSON.stringify({
        isoTimestamp: "2021-04-01T15:00:00Z",
        fetchedAt: "2026-07-04T00:00:00.000Z",
        markets: ["h2h", "spreads", "totals"],
        events: [{ id: "odds-1" }, { id: "odds-2" }],
      })
    );

    const manifest = buildOddsCacheManifest(cacheDir);

    expect(manifest.cacheDir).toBe(cacheDir);
    expect(manifest.totals).toMatchObject({
      snapshots: 1,
      fullMarketSnapshots: 1,
      moneylineOnlySnapshots: 0,
      events: 2,
    });
    expect(manifest.snapshots).toEqual([
      expect.objectContaining({
        season: 2021,
        isoTimestamp: "2021-04-01T15:00:00Z",
        path: cachePath,
        markets: ["h2h", "spreads", "totals"],
        eventCount: 2,
        fetchedAt: "2026-07-04T00:00:00.000Z",
      }),
    ]);
  });
});

function scheduleBody() {
  return {
    dates: [
      {
        games: [
          scheduledGame("1", "2021-04-01T17:05:00Z", "2021-04-01"),
          scheduledGame("2", "2021-04-15T18:00:00Z", "2021-04-15"),
        ],
      },
    ],
  };
}

function scheduledGame(gamePk: string, gameDate: string, officialDate: string) {
  return {
    gamePk,
    gameDate,
    officialDate,
    status: {
      abstractGameState: "Final",
      detailedState: "Final",
    },
    teams: {
      away: { score: 3, team: { id: 1, name: "Away Club" }, probablePitcher: { id: 202, fullName: "Away Starter" } },
      home: { score: 5, team: { id: 2, name: "Home Club" }, probablePitcher: { id: 101, fullName: "Home Starter" } },
    },
    venue: {
      id: 10,
      name: "Test Park",
      location: {
        defaultCoordinates: {
          latitude: 40,
          longitude: -75,
        },
        azimuthAngle: 75,
      },
    },
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function writePitcherCache(
  pitcherLogCacheDir: string,
  season: number,
  pitcherId: number,
  logs: Array<Record<string, unknown>>
): void {
  const seasonDir = join(pitcherLogCacheDir, String(season));
  mkdirSync(seasonDir, { recursive: true });
  writeFileSync(
    join(seasonDir, `${pitcherId}.json`),
    JSON.stringify({
      season,
      pitcherId,
      logs,
    })
  );
}

function pitcherLog(overrides: {
  playerId: number;
  date: string;
  strikeOuts: number;
  baseOnBalls: number;
  homeRuns: number;
}): Record<string, unknown> {
  return {
    playerId: overrides.playerId,
    playerName: "Starter",
    season: 2021,
    gamePk: Number(overrides.date.replace(/\D/g, "")),
    date: overrides.date,
    gamesStarted: 1,
    outs: 18,
    inningsPitched: "6.0",
    homeRuns: overrides.homeRuns,
    strikeOuts: overrides.strikeOuts,
    baseOnBalls: overrides.baseOnBalls,
    hitByPitch: 0,
    earnedRuns: 2,
  };
}

function tempLedgerPath(): string {
  const ledgerDir = mkdtempSync(join(tmpdir(), "mlb-edge-ledger-"));
  tempDirs.push(ledgerDir);
  return join(ledgerDir, "api-calls.jsonl");
}
