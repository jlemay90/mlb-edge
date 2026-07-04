import { describe, expect, it } from "vitest";
import { fetchFinalScores, fetchMlbPitcherGameLog, fetchMlbSchedule } from "../server/providers/mlbStats";
import { fetchHistoricalMlbOdds, fetchMlbOdds } from "../server/providers/oddsApi";
import { fetchGameWeather, fetchHistoricalGameWeather } from "../server/providers/weather";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

function jsonResponse(
  body: unknown,
  ok = true,
  status = ok ? 200 : 500,
  headers: Record<string, string> = {}
): Response {
  return {
    ok,
    status,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("MLB Stats provider", () => {
  it("requests the MLB schedule URL and normalizes games", async () => {
    const calls: FetchCall[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return jsonResponse({
        dates: [
          {
            games: [
              {
                gamePk: 123,
                gameDate: "2026-07-01T23:05:00Z",
                status: { abstractGameState: "Preview", detailedState: "Scheduled" },
                venue: {
                  id: 3313,
                  name: "Yankee Stadium",
                  location: {
                    defaultCoordinates: {
                      latitude: 40.82919482,
                      longitude: -73.9264977,
                    },
                    azimuthAngle: 75,
                  },
                },
                teams: {
                  home: {
                    team: { id: 147, name: "New York Yankees" },
                    probablePitcher: { id: 1, fullName: "Home Starter" },
                  },
                  away: {
                    team: { id: 110, name: "Baltimore Orioles" },
                    probablePitcher: { id: 2, fullName: "Away Starter" },
                  },
                },
              },
            ],
          },
        ],
      });
    };

    const result = await fetchMlbSchedule("2026-07-01", fetchImpl);

    expect(result.ok).toBe(true);
    expect(calls[0]!.url).toContain("https://statsapi.mlb.com/api/v1/schedule");
    expect(calls[0]!.url).toContain("sportId=1");
    expect(calls[0]!.url).toContain("date=2026-07-01");
    expect(result.ok && result.data[0]).toMatchObject({
      gameId: "123",
      homeTeam: "New York Yankees",
      awayTeam: "Baltimore Orioles",
      venue: "Yankee Stadium",
      venueId: "3313",
      venueLatitude: 40.82919482,
      venueLongitude: -73.9264977,
      venueAzimuthAngle: 75,
      homeProbablePitcherId: 1,
      homeProbablePitcher: "Home Starter",
      awayProbablePitcherId: 2,
      awayProbablePitcher: "Away Starter",
      status: "scheduled",
    });
  });

  it("requests and normalizes MLB pitcher game logs for starter history", async () => {
    const calls: FetchCall[] = [];
    const result = await fetchMlbPitcherGameLog(673540, 2023, async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
        stats: [
          {
            splits: [
              {
                season: "2023",
                date: "2023-04-02",
                player: { id: 673540, fullName: "Kodai Senga" },
                game: { gamePk: 718741 },
                stat: {
                  gamesStarted: 1,
                  outs: 16,
                  inningsPitched: "5.1",
                  homeRuns: 0,
                  strikeOuts: 8,
                  baseOnBalls: 3,
                  hitByPitch: 0,
                  earnedRuns: 1,
                },
              },
            ],
          },
        ],
      });
    });

    expect(result.ok).toBe(true);
    expect(calls[0]!.url).toContain("/api/v1/people/673540/stats");
    expect(calls[0]!.url).toContain("stats=gameLog");
    expect(calls[0]!.url).toContain("group=pitching");
    expect(calls[0]!.url).toContain("season=2023");
    expect(result.ok && result.data).toEqual([
      {
        playerId: 673540,
        playerName: "Kodai Senga",
        season: 2023,
        gamePk: 718741,
        date: "2023-04-02",
        gamesStarted: 1,
        outs: 16,
        inningsPitched: "5.1",
        homeRuns: 0,
        strikeOuts: 8,
        baseOnBalls: 3,
        hitByPitch: 0,
        earnedRuns: 1,
      },
    ]);
  });

  it("normalizes final scores and voidable statuses", async () => {
    let callCount = 0;
    const fetchImpl = async () =>
      {
        callCount += 1;
        return jsonResponse({
        dates: [
          {
            games: [
              {
                gamePk: 123,
                status: { abstractGameState: "Final", detailedState: "Final" },
                teams: {
                  home: { team: { name: "Home Club" }, score: 5 },
                  away: { team: { name: "Away Club" }, score: 3 },
                },
              },
              {
                gamePk: 456,
                status: { abstractGameState: "Preview", detailedState: "Postponed" },
                teams: {
                  home: { team: { name: "Rain Home" } },
                  away: { team: { name: "Rain Away" } },
                },
              },
            ],
          },
        ],
        });
      };

    const result = await fetchFinalScores("2026-07-01", fetchImpl);

    expect(result.ok).toBe(true);
    expect(callCount).toBe(1);
    expect(result.ok && result.data).toEqual([
      {
        gameId: "123",
        status: "final",
        homeTeam: "Home Club",
        awayTeam: "Away Club",
        homeScore: 5,
        awayScore: 3,
      },
      {
        gameId: "456",
        status: "postponed",
        homeTeam: "Rain Home",
        awayTeam: "Rain Away",
        homeScore: undefined,
        awayScore: undefined,
      },
    ]);
  });

  it("returns a safe error instead of throwing on bad MLB responses", async () => {
    const result = await fetchMlbSchedule("2026-07-01", async () => jsonResponse({ message: "down" }, false, 503));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("MLB Stats API");
  });
});

describe("Odds API provider", () => {
  it("requires an API key at call time without touching fetch", async () => {
    let called = false;
    const result = await fetchMlbOdds({
      apiKey: " ",
      fetchImpl: async () => {
        called = true;
        return jsonResponse([]);
      },
    });

    expect(called).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("ODDS_API_KEY");
  });

  it("requests current MLB odds and normalizes bookmaker markets", async () => {
    const calls: FetchCall[] = [];
    const result = await fetchMlbOdds({
      apiKey: "test-key",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return jsonResponse([
          {
            id: "event-1",
            commence_time: "2026-07-01T23:05:00Z",
            home_team: "Home Club",
            away_team: "Away Club",
            bookmakers: [
              {
                key: "draftkings",
                title: "DraftKings",
                last_update: "2026-07-01T18:00:00Z",
                markets: [
                  {
                    key: "h2h",
                    outcomes: [
                      { name: "Home Club", price: -125 },
                      { name: "Away Club", price: 105 },
                    ],
                  },
                ],
              },
            ],
          },
        ]);
      },
    });

    expect(result.ok).toBe(true);
    expect(calls[0]!.url).toContain("https://api.the-odds-api.com/v4/sports/baseball_mlb/odds");
    expect(calls[0]!.url).toContain("apiKey=test-key");
    expect(calls[0]!.url).toContain("markets=h2h%2Cspreads%2Ctotals");
    expect(result.ok && result.data[0]!.bookmakers[0]!.markets[0]!.outcomes[0]).toEqual({
      name: "Home Club",
      price: -125,
      point: undefined,
    });
  });

  it("requests historical MLB odds for backtesting", async () => {
    const calls: FetchCall[] = [];
    const result = await fetchHistoricalMlbOdds({
      apiKey: "test-key",
      isoTimestamp: "2026-06-15T16:00:00Z",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return jsonResponse({ timestamp: "2026-06-15T16:00:00Z", data: [] });
      },
    });

    expect(result.ok).toBe(true);
    expect(calls[0]!.url).toContain("/v4/historical/sports/baseball_mlb/odds");
    expect(calls[0]!.url).toContain("date=2026-06-15T16%3A00%3A00Z");
  });

  it("returns request usage headers on Odds API failures", async () => {
    const result = await fetchMlbOdds({
      apiKey: "test-key",
      fetchImpl: async () =>
        jsonResponse(
          { message: "quota exceeded" },
          false,
          401,
          {
            "x-requests-remaining": "0",
            "x-requests-used": "20000",
            "x-requests-last": "0",
          }
        ),
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(401);
    expect(result.requestUsage).toEqual({
      requestsRemaining: "0",
      requestsUsed: "20000",
      requestsLast: "0",
    });
  });
});

describe("weather provider", () => {
  it("uses National Weather Service first with a User-Agent header", async () => {
    const calls: FetchCall[] = [];
    const result = await fetchGameWeather({
      latitude: 40.8296,
      longitude: -73.9262,
      firstPitchIso: "2026-07-01T23:05:00Z",
      userAgent: "mlb-edge-lab/test",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        if (url.includes("/points/")) {
          return jsonResponse({ properties: { forecastHourly: "https://api.weather.gov/gridpoints/OKX/33,37/forecast/hourly" } });
        }
        return jsonResponse({
          properties: {
            periods: [
              {
                startTime: "2026-07-01T23:00:00Z",
                temperature: 82,
                windSpeed: "12 mph",
                windDirection: "SW",
                shortForecast: "Partly Cloudy",
              },
            ],
          },
        });
      },
    });

    expect(result.ok).toBe(true);
    expect(calls[0]!.url).toContain("https://api.weather.gov/points/40.8296,-73.9262");
    expect((calls[0]!.init!.headers as Record<string, string>)["User-Agent"]).toBe("mlb-edge-lab/test");
    expect(result.ok && result.data.source).toBe("nws");
    expect(result.ok && result.data.temperatureF).toBe(82);
  });

  it("falls back to Open-Meteo when NWS is unavailable", async () => {
    const calls: FetchCall[] = [];
    const result = await fetchGameWeather({
      latitude: 43.6414,
      longitude: -79.3894,
      firstPitchIso: "2026-07-01T23:05:00Z",
      userAgent: "mlb-edge-lab/test",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        if (url.includes("weather.gov")) {
          return jsonResponse({ message: "outside NWS grid" }, false, 404);
        }
        return jsonResponse({
          hourly: {
            time: ["2026-07-01T23:00"],
            temperature_2m: [74],
            wind_speed_10m: [9],
            wind_direction_10m: [250],
          },
        });
      },
    });

    expect(result.ok).toBe(true);
    expect(calls.some((call) => call.url.includes("api.open-meteo.com"))).toBe(true);
    expect(result.ok && result.data.source).toBe("open-meteo");
    expect(result.ok && result.data.temperatureF).toBe(74);
  });

  it("requests historical Open-Meteo archive weather for backtesting", async () => {
    const calls: FetchCall[] = [];
    const result = await fetchHistoricalGameWeather({
      latitude: 38.5802,
      longitude: -121.513,
      firstPitchIso: "2025-07-01T02:05:00Z",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return jsonResponse({
          hourly: {
            time: ["2025-07-01T01:00", "2025-07-01T02:00", "2025-07-01T03:00"],
            temperature_2m: [87, 84, 80],
            wind_speed_10m: [6, 9, 11],
            wind_direction_10m: [180, 225, 270],
          },
        });
      },
    });

    expect(result.ok).toBe(true);
    expect(calls[0]!.url).toContain("https://archive-api.open-meteo.com/v1/archive");
    expect(calls[0]!.url).toContain("start_date=2025-07-01");
    expect(calls[0]!.url).toContain("end_date=2025-07-01");
    expect(calls[0]!.url).toContain("temperature_unit=fahrenheit");
    expect(calls[0]!.url).toContain("wind_speed_unit=mph");
    expect(calls[0]!.url).toContain("timezone=UTC");
    expect(result.ok && result.data.source).toBe("open-meteo-archive");
    expect(result.ok && result.data.temperatureF).toBe(84);
    expect(result.ok && result.data.windSpeedMph).toBe(9);
    expect(result.ok && result.data.windDirection).toBe("SW");
  });

  it("returns a safe weather error when all sources fail", async () => {
    const result = await fetchGameWeather({
      latitude: 0,
      longitude: 0,
      firstPitchIso: "2026-07-01T23:05:00Z",
      userAgent: "mlb-edge-lab/test",
      fetchImpl: async () => jsonResponse({ error: "down" }, false, 500),
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("Weather unavailable");
  });
});
