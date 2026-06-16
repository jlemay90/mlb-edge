/**
 * MLB Data Ingestion Service
 * Pulls from: MLB Stats API, Baseball Savant/Statcast, The Odds API, OpenWeather
 */

import axios from "axios";

const MLB_API = "https://statsapi.mlb.com/api/v1";
const SAVANT_API = "https://baseballsavant.mlb.com";
const ODDS_API = "https://api.the-odds-api.com/v4";
const WEATHER_API = "https://api.openweathermap.org/data/2.5";

// ─── Stadium Coordinates & Park Factors ──────────────────────────────────────

export const STADIUM_DATA: Record<
  number,
  {
    name: string;
    lat: number;
    lon: number;
    altFt: number;
    parkFactorRuns: number;
    parkFactorHR: number;
    parkFactorHits: number;
    surface: string;
  }
> = {
  133: { name: "Sutter Health Park", lat: 38.5816, lon: -121.4944, altFt: 26, parkFactorRuns: 115, parkFactorHR: 125, parkFactorHits: 110, surface: "grass" },
  134: { name: "PNC Park", lat: 40.4469, lon: -80.0057, altFt: 730, parkFactorRuns: 97, parkFactorHR: 96, parkFactorHits: 98, surface: "grass" },
  135: { name: "Petco Park", lat: 32.7073, lon: -117.1566, altFt: 62, parkFactorRuns: 91, parkFactorHR: 86, parkFactorHits: 93, surface: "grass" },
  136: { name: "T-Mobile Park", lat: 47.5914, lon: -122.3325, altFt: 0, parkFactorRuns: 96, parkFactorHR: 94, parkFactorHits: 97, surface: "grass" },
  137: { name: "Oracle Park", lat: 37.7786, lon: -122.3893, altFt: 0, parkFactorRuns: 88, parkFactorHR: 80, parkFactorHits: 90, surface: "grass" },
  138: { name: "Busch Stadium", lat: 38.6226, lon: -90.1928, altFt: 465, parkFactorRuns: 99, parkFactorHR: 98, parkFactorHits: 100, surface: "grass" },
  139: { name: "Tropicana Field", lat: 27.7683, lon: -82.6534, altFt: 0, parkFactorRuns: 97, parkFactorHR: 95, parkFactorHits: 97, surface: "artificial" },
  140: { name: "Globe Life Field", lat: 32.7473, lon: -97.0822, altFt: 551, parkFactorRuns: 102, parkFactorHR: 105, parkFactorHits: 101, surface: "artificial" },
  141: { name: "Rogers Centre", lat: 43.6414, lon: -79.3894, altFt: 300, parkFactorRuns: 104, parkFactorHR: 108, parkFactorHits: 103, surface: "artificial" },
  142: { name: "Target Field", lat: 44.9817, lon: -93.2781, altFt: 841, parkFactorRuns: 100, parkFactorHR: 99, parkFactorHits: 100, surface: "grass" },
  143: { name: "Citizens Bank Park", lat: 39.9061, lon: -75.1665, altFt: 20, parkFactorRuns: 105, parkFactorHR: 110, parkFactorHits: 104, surface: "grass" },
  144: { name: "Truist Park", lat: 33.8908, lon: -84.4678, altFt: 1050, parkFactorRuns: 101, parkFactorHR: 103, parkFactorHits: 101, surface: "grass" },
  145: { name: "Guaranteed Rate Field", lat: 41.8299, lon: -87.6338, altFt: 595, parkFactorRuns: 100, parkFactorHR: 102, parkFactorHits: 100, surface: "grass" },
  146: { name: "loanDepot park", lat: 25.7781, lon: -80.2197, altFt: 6, parkFactorRuns: 92, parkFactorHR: 89, parkFactorHits: 93, surface: "grass" },
  147: { name: "Yankee Stadium", lat: 40.8296, lon: -73.9262, altFt: 55, parkFactorRuns: 103, parkFactorHR: 108, parkFactorHits: 102, surface: "grass" },
  158: { name: "American Family Field", lat: 43.0280, lon: -87.9712, altFt: 635, parkFactorRuns: 101, parkFactorHR: 104, parkFactorHits: 101, surface: "grass" },
  108: { name: "Angel Stadium", lat: 33.8003, lon: -117.8827, altFt: 160, parkFactorRuns: 98, parkFactorHR: 97, parkFactorHits: 99, surface: "grass" },
  109: { name: "Chase Field", lat: 33.4453, lon: -112.0667, altFt: 1082, parkFactorRuns: 104, parkFactorHR: 107, parkFactorHits: 103, surface: "grass" },
  110: { name: "Camden Yards", lat: 39.2838, lon: -76.6218, altFt: 20, parkFactorRuns: 101, parkFactorHR: 103, parkFactorHits: 101, surface: "grass" },
  111: { name: "Fenway Park", lat: 42.3467, lon: -71.0972, altFt: 20, parkFactorRuns: 104, parkFactorHR: 102, parkFactorHits: 106, surface: "grass" },
  112: { name: "Wrigley Field", lat: 41.9484, lon: -87.6553, altFt: 595, parkFactorRuns: 103, parkFactorHR: 106, parkFactorHits: 103, surface: "grass" },
  113: { name: "Great American Ball Park", lat: 39.0975, lon: -84.5081, altFt: 490, parkFactorRuns: 106, parkFactorHR: 112, parkFactorHits: 105, surface: "grass" },
  114: { name: "Progressive Field", lat: 41.4962, lon: -81.6852, altFt: 653, parkFactorRuns: 98, parkFactorHR: 96, parkFactorHits: 99, surface: "grass" },
  115: { name: "Coors Field", lat: 39.7559, lon: -104.9942, altFt: 5200, parkFactorRuns: 115, parkFactorHR: 120, parkFactorHits: 112, surface: "grass" },
  116: { name: "Comerica Park", lat: 42.3390, lon: -83.0485, altFt: 600, parkFactorRuns: 96, parkFactorHR: 92, parkFactorHits: 97, surface: "grass" },
  117: { name: "Minute Maid Park", lat: 29.7573, lon: -95.3555, altFt: 43, parkFactorRuns: 100, parkFactorHR: 101, parkFactorHits: 100, surface: "grass" },
  118: { name: "Kauffman Stadium", lat: 39.0517, lon: -94.4803, altFt: 1014, parkFactorRuns: 97, parkFactorHR: 95, parkFactorHits: 98, surface: "grass" },
  119: { name: "Dodger Stadium", lat: 34.0739, lon: -118.2400, altFt: 515, parkFactorRuns: 97, parkFactorHR: 96, parkFactorHits: 98, surface: "grass" },
  120: { name: "Nationals Park", lat: 38.8730, lon: -77.0074, altFt: 25, parkFactorRuns: 99, parkFactorHR: 100, parkFactorHits: 99, surface: "grass" },
  121: { name: "Citi Field", lat: 40.7571, lon: -73.8458, altFt: 20, parkFactorRuns: 96, parkFactorHR: 93, parkFactorHits: 97, surface: "grass" },
};

// ─── MLB Stats API ────────────────────────────────────────────────────────────

export async function fetchTodaysSchedule(date?: string): Promise<any[]> {
  const gameDate = date || new Date().toISOString().split("T")[0];
  try {
    const res = await axios.get(`${MLB_API}/schedule`, {
      params: {
        sportId: 1,
        date: gameDate,
        hydrate: "team,linescore,probablePitcher,officials,weather",
      },
      timeout: 10000,
    });
    const dates = res.data?.dates || [];
    return dates.flatMap((d: any) => d.games || []);
  } catch (err) {
    console.error("[MLB API] Schedule fetch failed:", err);
    return [];
  }
}

export async function fetchTeamStats(teamId: number, season: number): Promise<any> {
  try {
    const [hitting, pitching, standings] = await Promise.all([
      axios.get(`${MLB_API}/teams/${teamId}/stats`, {
        params: { stats: "season", group: "hitting", season, sportId: 1 },
        timeout: 8000,
      }),
      axios.get(`${MLB_API}/teams/${teamId}/stats`, {
        params: { stats: "season", group: "pitching", season, sportId: 1 },
        timeout: 8000,
      }),
      axios.get(`${MLB_API}/standings`, {
        params: { leagueId: "103,104", season, hydrate: "team,record" },
        timeout: 8000,
      }),
    ]);

    const hittingStats = hitting.data?.stats?.[0]?.splits?.[0]?.stat || {};
    const pitchingStats = pitching.data?.stats?.[0]?.splits?.[0]?.stat || {};

    // Find team record in standings
    let wins = 0, losses = 0;
    const records = standings.data?.records || [];
    for (const record of records) {
      const teamRecord = record.teamRecords?.find((r: any) => r.team?.id === teamId);
      if (teamRecord) {
        wins = teamRecord.wins;
        losses = teamRecord.losses;
        break;
      }
    }

    return { hittingStats, pitchingStats, wins, losses };
  } catch (err) {
    console.error(`[MLB API] Team stats fetch failed for team ${teamId}:`, err);
    return null;
  }
}

export async function fetchPitcherStats(playerId: number, season: number): Promise<any> {
  try {
    const res = await axios.get(`${MLB_API}/people/${playerId}/stats`, {
      params: {
        stats: "season,seasonAdvanced",
        group: "pitching",
        season,
        sportId: 1,
      },
      timeout: 8000,
    });
    return res.data?.stats || [];
  } catch (err) {
    console.error(`[MLB API] Pitcher stats fetch failed for player ${playerId}:`, err);
    return [];
  }
}

export async function fetchAllTeams(): Promise<any[]> {
  try {
    const res = await axios.get(`${MLB_API}/teams`, {
      params: { sportId: 1, season: new Date().getFullYear() },
      timeout: 8000,
    });
    return res.data?.teams || [];
  } catch (err) {
    console.error("[MLB API] Teams fetch failed:", err);
    return [];
  }
}

// ─── Baseball Savant / Statcast ───────────────────────────────────────────────

export async function fetchStatcastTeamData(teamAbbr: string, season: number): Promise<any> {
  try {
    // Statcast team batting stats
    const res = await axios.get(`${SAVANT_API}/statcast_search/csv`, {
      params: {
        all: true,
        hfSea: `${season}|`,
        player_type: "batter",
        team: teamAbbr,
        type: "details",
        min_results: 0,
        group_by: "team",
        sort_col: "pitches",
        sort_order: "desc",
        min_pas: 0,
      },
      timeout: 15000,
    });
    return res.data;
  } catch (err) {
    console.error(`[Savant] Statcast team data failed for ${teamAbbr}:`, err);
    return null;
  }
}

export async function fetchStatcastLeaderboard(season: number, minPA = 100): Promise<any[]> {
  try {
    const res = await axios.get(`${SAVANT_API}/leaderboard/expected_statistics`, {
      params: {
        type: "batter",
        year: season,
        position: "",
        team: "",
        min_pa: minPA,
      },
      timeout: 15000,
    });
    return res.data?.data || [];
  } catch (err) {
    console.error("[Savant] Leaderboard fetch failed:", err);
    return [];
  }
}

// ─── The Odds API ─────────────────────────────────────────────────────────────

export async function fetchMLBOdds(markets = "h2h,spreads,totals"): Promise<any[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("ODDS_API_KEY not configured");

  try {
    const res = await axios.get(`${ODDS_API}/sports/baseball_mlb/odds`, {
      params: {
        apiKey,
        regions: "us",
        markets,
        bookmakers: "draftkings,fanduel",
        oddsFormat: "american",
        dateFormat: "iso",
      },
      timeout: 10000,
    });
    return res.data || [];
  } catch (err: any) {
    console.error("[Odds API] MLB odds fetch failed:", err?.response?.data || err.message);
    return [];
  }
}

export async function fetchMLBPlayerProps(eventId: string): Promise<any> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("ODDS_API_KEY not configured");

  try {
    const res = await axios.get(
      `${ODDS_API}/sports/baseball_mlb/events/${eventId}/odds`,
      {
        params: {
          apiKey,
          regions: "us",
          // DK/FD don't post props via the API — use all available books for props
          // (williamhill_us, betrivers are the primary sources for MLB player props)
          markets: [
            "batter_hits",
            "batter_home_runs",
            "batter_rbis",
            "batter_stolen_bases",
            "batter_total_bases",
            "pitcher_strikeouts",
            "pitcher_hits_allowed",
            "pitcher_walks",
            "pitcher_earned_runs",
            "pitcher_outs",
          ].join(","),
          oddsFormat: "american",
        },
        timeout: 10000,
      }
    );
    return res.data;
  } catch (err: any) {
    console.error("[Odds API] Player props fetch failed:", err?.response?.data || err.message);
    return null;
  }
}

export async function fetchMLBEvents(): Promise<any[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("ODDS_API_KEY not configured");

  try {
    const res = await axios.get(`${ODDS_API}/sports/baseball_mlb/events`, {
      params: { apiKey, dateFormat: "iso" },
      timeout: 10000,
    });
    return res.data || [];
  } catch (err: any) {
    console.error("[Odds API] Events fetch failed:", err?.response?.data || err.message);
    return [];
  }
}

// ─── Weather Service ──────────────────────────────────────────────────────────

export function getWindDirectionLabel(
  windDeg: number,
  stadiumOrientation = 0
): string {
  // Normalize relative to stadium home plate direction
  const relative = (windDeg - stadiumOrientation + 360) % 360;
  if (relative >= 315 || relative < 45) return "Out to CF";
  if (relative >= 45 && relative < 135) return "Out to RF";
  if (relative >= 135 && relative < 225) return "In from CF";
  if (relative >= 225 && relative < 315) return "Out to LF";
  return "Cross Wind";
}

export function calculateWindRunImpact(
  windSpeedMph: number,
  windDirLabel: string,
  tempF: number,
  altitudeFt: number
): number {
  let impact = 0;

  // Wind direction impact — reduced weighting to prevent overemphasis
  if (windDirLabel === "Out to CF") impact += windSpeedMph * 0.025;
  else if (windDirLabel === "In from CF") impact -= windSpeedMph * 0.02;
  else if (windDirLabel.startsWith("Out to")) impact += windSpeedMph * 0.015;
  else impact -= windSpeedMph * 0.01;

  // Temperature impact — increased sensitivity for extreme heat (>82°F)
  const tempAdj = tempF > 82 ? 0.035 : 0.015;
  impact += (tempF - 72) * tempAdj;

  // Altitude impact (already baked into park factors, add marginal)
  if (altitudeFt > 3000) impact += 0.3;

  return Math.round(impact * 10) / 10;
}

export async function fetchGameWeather(
  gamePk: number,
  lat: number,
  lon: number,
  altFt: number,
  apiKey?: string
): Promise<{
  tempF: number;
  feelsLikeF: number;
  windSpeedMph: number;
  windDirDeg: number;
  windDirLabel: string;
  humidity: number;
  conditions: string;
  precipChance: number;
  runImpact: number;
} | null> {
  if (!apiKey) {
    // Return estimated weather based on typical conditions if no key
    return {
      tempF: 72,
      feelsLikeF: 72,
      windSpeedMph: 8,
      windDirDeg: 180,
      windDirLabel: "In from CF",
      humidity: 55,
      conditions: "Clear",
      precipChance: 0,
      runImpact: 0,
    };
  }

  try {
    const res = await axios.get(`${WEATHER_API}/weather`, {
      params: { lat, lon, appid: apiKey, units: "imperial" },
      timeout: 8000,
    });

    const data = res.data;
    const tempF = data.main?.temp || 72;
    const feelsLikeF = data.main?.feels_like || tempF;
    const windSpeedMph = (data.wind?.speed || 0) * 2.237; // m/s to mph if needed
    const windDirDeg = data.wind?.deg || 0;
    const humidity = data.main?.humidity || 50;
    const conditions = data.weather?.[0]?.description || "Clear";
    const precipChance = data.pop || 0;
    const windDirLabel = getWindDirectionLabel(windDirDeg);
    const runImpact = calculateWindRunImpact(windSpeedMph, windDirLabel, tempF, altFt);

    return {
      tempF: Math.round(tempF),
      feelsLikeF: Math.round(feelsLikeF),
      windSpeedMph: Math.round(windSpeedMph * 10) / 10,
      windDirDeg,
      windDirLabel,
      humidity,
      conditions,
      precipChance,
      runImpact,
    };
  } catch (err) {
    console.error(`[Weather] Fetch failed for game ${gamePk}:`, err);
    return null;
  }
}

// ─── Umpire Data ──────────────────────────────────────────────────────────────

// Hardcoded umpire tendencies from umpire scorecards data
// These are approximate values based on publicly available umpire analysis
export const UMPIRE_DATA: Record<
  string,
  {
    strikeZoneSize: number;
    kPctAboveAvg: number;
    bbPctAboveAvg: number;
    homeFavorScore: number;
    pitcherFavorScore: number;
    avgRunsPerGame: number;
    overPct: number;
  }
> = {
  "Angel Hernandez": { strikeZoneSize: 0.95, kPctAboveAvg: -1.2, bbPctAboveAvg: 0.8, homeFavorScore: 0.3, pitcherFavorScore: -0.5, avgRunsPerGame: 9.4, overPct: 52 },
  "CB Bucknor": { strikeZoneSize: 0.93, kPctAboveAvg: -1.5, bbPctAboveAvg: 1.1, homeFavorScore: 0.1, pitcherFavorScore: -0.8, avgRunsPerGame: 9.6, overPct: 54 },
  "Joe West": { strikeZoneSize: 1.02, kPctAboveAvg: 0.8, bbPctAboveAvg: -0.5, homeFavorScore: 0.2, pitcherFavorScore: 0.4, avgRunsPerGame: 8.9, overPct: 48 },
  "Phil Cuzzi": { strikeZoneSize: 0.98, kPctAboveAvg: 0.2, bbPctAboveAvg: -0.1, homeFavorScore: 0.0, pitcherFavorScore: 0.1, avgRunsPerGame: 9.1, overPct: 50 },
  "Dan Iassogna": { strikeZoneSize: 1.05, kPctAboveAvg: 1.8, bbPctAboveAvg: -1.2, homeFavorScore: -0.1, pitcherFavorScore: 0.9, avgRunsPerGame: 8.5, overPct: 44 },
  "Vic Carapazza": { strikeZoneSize: 1.08, kPctAboveAvg: 2.1, bbPctAboveAvg: -1.5, homeFavorScore: 0.0, pitcherFavorScore: 1.2, avgRunsPerGame: 8.3, overPct: 43 },
  "Nic Lentz": { strikeZoneSize: 1.06, kPctAboveAvg: 1.9, bbPctAboveAvg: -1.3, homeFavorScore: 0.1, pitcherFavorScore: 1.0, avgRunsPerGame: 8.4, overPct: 44 },
  "Mark Carlson": { strikeZoneSize: 0.97, kPctAboveAvg: -0.3, bbPctAboveAvg: 0.2, homeFavorScore: 0.2, pitcherFavorScore: -0.2, avgRunsPerGame: 9.2, overPct: 51 },
  "Brian Gorman": { strikeZoneSize: 1.01, kPctAboveAvg: 0.5, bbPctAboveAvg: -0.3, homeFavorScore: 0.1, pitcherFavorScore: 0.3, avgRunsPerGame: 9.0, overPct: 49 },
  "default": { strikeZoneSize: 1.0, kPctAboveAvg: 0, bbPctAboveAvg: 0, homeFavorScore: 0, pitcherFavorScore: 0, avgRunsPerGame: 9.1, overPct: 50 },
};

export function getUmpireTendency(umpireName: string) {
  return UMPIRE_DATA[umpireName] || UMPIRE_DATA["default"];
}

// ─── Team Name / ID Mapping ───────────────────────────────────────────────────

export const TEAM_ABBR_MAP: Record<number, string> = {
  108: "LAA", 109: "ARI", 110: "BAL", 111: "BOS", 112: "CHC",
  113: "CIN", 114: "CLE", 115: "COL", 116: "DET", 117: "HOU",
  118: "KC",  119: "LAD", 120: "WSH", 121: "NYM", 133: "OAK",
  134: "PIT", 135: "SD",  136: "SEA", 137: "SF",  138: "STL",
  139: "TB",  140: "TEX", 141: "TOR", 142: "MIN", 143: "PHI",
  144: "ATL", 145: "CWS", 146: "MIA", 147: "NYY", 158: "MIL",
};

export const ODDS_TEAM_MAP: Record<string, number> = {
  "Los Angeles Angels": 108, "Arizona Diamondbacks": 109, "Baltimore Orioles": 110,
  "Boston Red Sox": 111, "Chicago Cubs": 112, "Cincinnati Reds": 113,
  "Cleveland Guardians": 114, "Colorado Rockies": 115, "Detroit Tigers": 116,
  "Houston Astros": 117, "Kansas City Royals": 118, "Los Angeles Dodgers": 119,
  "Washington Nationals": 120, "New York Mets": 121,   "Las Vegas Athletics": 133,
  "Pittsburgh Pirates": 134, "San Diego Padres": 135, "Seattle Mariners": 136,
  "San Francisco Giants": 137, "St. Louis Cardinals": 138, "Tampa Bay Rays": 139,
  "Texas Rangers": 140, "Toronto Blue Jays": 141, "Minnesota Twins": 142,
  "Philadelphia Phillies": 143, "Atlanta Braves": 144, "Chicago White Sox": 145,
  "Miami Marlins": 146, "New York Yankees": 147, "Milwaukee Brewers": 158,
};

// ─── Model Upgrade: Confirmed Lineups ────────────────────────────────────────

/**
 * Fetch confirmed starting lineups for a game.
 * Returns null if lineups haven't been posted yet (typically 2-3 hrs before first pitch).
 */
export async function fetchConfirmedLineups(gamePk: number): Promise<{
  home: Array<{ id: number; name: string; position: string; battingOrder: number }>;
  away: Array<{ id: number; name: string; position: string; battingOrder: number }>;
} | null> {
  try {
    const res = await axios.get(`${MLB_API}/game/${gamePk}/boxscore`, { timeout: 8000 });
    const home = res.data?.teams?.home?.battingOrder || [];
    const away = res.data?.teams?.away?.battingOrder || [];
    const homePlayers = res.data?.teams?.home?.players || {};
    const awayPlayers = res.data?.teams?.away?.players || {};

    if (!home.length && !away.length) return null; // Not posted yet

    const mapPlayer = (id: number, players: any, order: number) => {
      const p = players[`ID${id}`];
      return {
        id,
        name: p?.person?.fullName || "Unknown",
        position: p?.position?.abbreviation || "?",
        battingOrder: order + 1,
      };
    };

    return {
      home: home.map((id: number, i: number) => mapPlayer(id, homePlayers, i)),
      away: away.map((id: number, i: number) => mapPlayer(id, awayPlayers, i)),
    };
  } catch {
    return null;
  }
}

// ─── Model Upgrade: Pitcher Recent Form (Last 3 Starts) ──────────────────────

export interface PitcherRecentForm {
  playerId: number;
  name: string;
  last3ERA: number;        // ERA over last 3 starts
  last3WHIP: number;       // WHIP over last 3 starts
  last3Ks: number;         // Total Ks in last 3 starts
  last3IP: number;         // Total innings pitched
  last3HR: number;         // HR allowed in last 3 starts
  trend: "hot" | "cold" | "neutral"; // hot = ERA < 3.00, cold = ERA > 5.00
  starts: Array<{ date: string; ip: number; er: number; k: number; hr: number }>;
}

export async function fetchPitcherRecentForm(playerId: number, name: string): Promise<PitcherRecentForm | null> {
  try {
    const res = await axios.get(`${MLB_API}/people/${playerId}/stats`, {
      params: { stats: "gameLog", group: "pitching", season: new Date().getFullYear(), limit: 5 },
      timeout: 8000,
    });
    const splits = res.data?.stats?.[0]?.splits?.slice(0, 3) || [];
    if (!splits.length) return null;

    let totalER = 0, totalIP = 0, totalKs = 0, totalHR = 0, totalHits = 0, totalBB = 0;
    const starts = splits.map((s: any) => {
      const ip = parseFloat(s.stat?.inningsPitched || "0");
      const er = s.stat?.earnedRuns || 0;
      const k = s.stat?.strikeOuts || 0;
      const hr = s.stat?.homeRuns || 0;
      totalER += er; totalIP += ip; totalKs += k; totalHR += hr;
      totalHits += s.stat?.hits || 0; totalBB += s.stat?.baseOnBalls || 0;
      return { date: s.date, ip, er, k, hr };
    });

    const last3ERA = totalIP > 0 ? parseFloat(((totalER * 9) / totalIP).toFixed(2)) : 0;
    const last3WHIP = totalIP > 0 ? parseFloat(((totalHits + totalBB) / totalIP).toFixed(2)) : 0;

    return {
      playerId, name, last3ERA, last3WHIP, last3Ks: totalKs, last3IP: totalIP,
      last3HR: totalHR,
      trend: last3ERA < 3.0 ? "hot" : last3ERA > 5.0 ? "cold" : "neutral",
      starts,
    };
  } catch {
    return null;
  }
}

// ─── Model Upgrade: Bullpen Usage & Rest ─────────────────────────────────────

export interface BullpenStatus {
  teamId: number;
  totalPitchesLast3Days: number;
  relieversUsedLast3Days: number;
  avgPitchesPerReliever: number;
  fatiguedRelievers: number; // count of relievers with 40+ pitches in last 3 days
  restScore: number;         // 0-100, higher = more rested
  summary: string;
}

export async function fetchBullpenStatus(teamId: number): Promise<BullpenStatus | null> {
  try {
    const res = await axios.get(`${MLB_API}/teams/${teamId}/roster`, {
      params: {
        rosterType: "active",
        season: new Date().getFullYear(),
        hydrate: `person(stats(type=gameLog,group=pitching,season=${new Date().getFullYear()},limit=4))`,
      },
      timeout: 10000,
    });

    const roster = res.data?.roster || [];
    const relievers = roster.filter((p: any) =>
      p.position?.abbreviation === "P" && p.status?.code !== "10D" && p.status?.code !== "60D"
    );

    const cutoff = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
    let totalPitches = 0, usedCount = 0, fatiguedCount = 0;

    for (const r of relievers) {
      const recentGames = (r.person?.stats?.[0]?.splits || []).filter(
        (s: any) => s.date >= cutoff
      );
      const pitches = recentGames.reduce((sum: number, g: any) => sum + (g.stat?.numberOfPitches || 0), 0);
      if (pitches > 0) { usedCount++; totalPitches += pitches; }
      if (pitches >= 40) fatiguedCount++;
    }

    const avgPitches = usedCount > 0 ? Math.round(totalPitches / usedCount) : 0;
    // Rest score: 100 = fully rested, 0 = exhausted
    const restScore = Math.max(0, Math.min(100, 100 - (totalPitches / Math.max(relievers.length, 1)) * 1.5));

    return {
      teamId, totalPitchesLast3Days: totalPitches, relieversUsedLast3Days: usedCount,
      avgPitchesPerReliever: avgPitches, fatiguedRelievers: fatiguedCount,
      restScore: Math.round(restScore),
      summary: fatiguedCount >= 2
        ? `Bullpen fatigued (${fatiguedCount} relievers 40+ pitches in 3 days)`
        : restScore >= 70
        ? "Bullpen well-rested"
        : "Bullpen moderately used",
    };
  } catch {
    return null;
  }
}

// ─── Model Upgrade: Batter vs Pitcher Statcast Matchups ──────────────────────

export interface BatterMatchup {
  batterId: number;
  pitcherId: number;
  pa: number;           // plate appearances
  avg: number;          // batting average
  slg: number;          // slugging
  hr: number;           // home runs
  kPct: number;         // strikeout %
  bbPct: number;        // walk %
  hardHitPct: number;   // hard hit %
  xba: number;          // expected batting average
  hrScore: number;      // composite HR likelihood score 0-1
}

export async function fetchBatterMatchup(batterId: number, pitcherId: number): Promise<BatterMatchup | null> {
  try {
    const url = `${SAVANT_API}/statcast_search/csv?hitter_id=${batterId}&pitcher_id=${pitcherId}&type=batter&year=${new Date().getFullYear()}`;
    const res = await axios.get(url, { timeout: 8000, responseType: "text" });
    const lines = (res.data as string).split("\n").filter(Boolean);
    if (lines.length < 2) return null; // No matchup data

    const headers = lines[0].split(",").map((h: string) => h.replace(/"/g, "").trim());
    const rows = lines.slice(1).map((line: string) => {
      const vals = line.split(",").map((v: string) => v.replace(/"/g, "").trim());
      const obj: Record<string, string> = {};
      headers.forEach((h: string, i: number) => { obj[h] = vals[i] || ""; });
      return obj;
    });

    const pa = rows.length;
    const hits = rows.filter(r => ["single", "double", "triple", "home_run"].includes(r.events)).length;
    const hrs = rows.filter(r => r.events === "home_run").length;
    const ks = rows.filter(r => r.events === "strikeout" || r.events === "strikeout_double_play").length;
    const bbs = rows.filter(r => r.events === "walk").length;
    const hardHit = rows.filter(r => parseFloat(r.launch_speed || "0") >= 95).length;
    const xbaVals = rows.map(r => parseFloat(r.estimated_ba_using_speedangle || "0")).filter(v => v > 0);
    const xba = xbaVals.length > 0 ? xbaVals.reduce((a, b) => a + b, 0) / xbaVals.length : 0;

    const totalBases = rows.reduce((sum, r) => {
      if (r.events === "single") return sum + 1;
      if (r.events === "double") return sum + 2;
      if (r.events === "triple") return sum + 3;
      if (r.events === "home_run") return sum + 4;
      return sum;
    }, 0);

    const avg = pa > 0 ? hits / pa : 0;
    const slg = pa > 0 ? totalBases / pa : 0;
    const kPct = pa > 0 ? ks / pa : 0;
    const bbPct = pa > 0 ? bbs / pa : 0;
    const hardHitPct = pa > 0 ? hardHit / pa : 0;

    // HR score: weighted composite of HR rate, hard hit %, xBA, SLG
    const hrRate = pa >= 5 ? hrs / pa : 0;
    const hrScore = Math.min(1, hrRate * 3 + hardHitPct * 0.5 + slg * 0.2 + xba * 0.3);

    return { batterId, pitcherId, pa, avg, slg, hr: hrs, kPct, bbPct, hardHitPct, xba, hrScore };
  } catch {
    return null;
  }
}

// ─── Model Upgrade: Handedness-Split Park Factors ────────────────────────────

// Park factor multipliers by batter handedness (L/R) for HR probability
// Source: FanGraphs park factors, 3-year average splits
export const PARK_FACTOR_SPLITS: Record<number, { hrL: number; hrR: number; runsL: number; runsR: number }> = {
  108: { hrL: 96,  hrR: 98,  runsL: 97,  runsR: 99  }, // Angel Stadium
  109: { hrL: 110, hrR: 104, runsL: 106, runsR: 103 }, // Chase Field
  110: { hrL: 105, hrR: 101, runsL: 102, runsR: 100 }, // Camden Yards
  111: { hrL: 95,  hrR: 108, runsL: 102, runsR: 106 }, // Fenway Park (Green Monster favors RHB)
  112: { hrL: 108, hrR: 104, runsL: 105, runsR: 102 }, // Wrigley Field
  113: { hrL: 115, hrR: 110, runsL: 108, runsR: 105 }, // GABP
  114: { hrL: 94,  hrR: 98,  runsL: 97,  runsR: 99  }, // Progressive Field
  115: { hrL: 122, hrR: 118, runsL: 116, runsR: 114 }, // Coors Field
  116: { hrL: 90,  hrR: 94,  runsL: 95,  runsR: 97  }, // Comerica Park
  117: { hrL: 102, hrR: 100, runsL: 101, runsR: 100 }, // Minute Maid Park
  118: { hrL: 93,  hrR: 97,  runsL: 96,  runsR: 98  }, // Kauffman Stadium
  119: { hrL: 94,  hrR: 98,  runsL: 96,  runsR: 98  }, // Dodger Stadium
  120: { hrL: 99,  hrR: 101, runsL: 99,  runsR: 100 }, // Nationals Park
  121: { hrL: 90,  hrR: 96,  runsL: 94,  runsR: 97  }, // Citi Field
  133: { hrL: 130, hrR: 120, runsL: 118, runsR: 112 }, // Sutter Health Park (extremely hitter-friendly)
  134: { hrL: 94,  hrR: 98,  runsL: 96,  runsR: 98  }, // PNC Park
  135: { hrL: 84,  hrR: 88,  runsL: 90,  runsR: 92  }, // Petco Park
  136: { hrL: 92,  hrR: 96,  runsL: 95,  runsR: 97  }, // T-Mobile Park
  137: { hrL: 78,  hrR: 82,  runsL: 87,  runsR: 89  }, // Oracle Park (pitcher's park)
  138: { hrL: 97,  hrR: 99,  runsL: 98,  runsR: 100 }, // Busch Stadium
  139: { hrL: 94,  hrR: 96,  runsL: 96,  runsR: 98  }, // Tropicana Field
  140: { hrL: 107, hrR: 103, runsL: 103, runsR: 101 }, // Globe Life Field
  141: { hrL: 110, hrR: 106, runsL: 105, runsR: 103 }, // Rogers Centre
  142: { hrL: 97,  hrR: 101, runsL: 99,  runsR: 101 }, // Target Field
  143: { hrL: 112, hrR: 108, runsL: 106, runsR: 104 }, // Citizens Bank Park
  144: { hrL: 101, hrR: 105, runsL: 100, runsR: 102 }, // Truist Park
  145: { hrL: 100, hrR: 104, runsL: 99,  runsR: 101 }, // Guaranteed Rate Field
  146: { hrL: 87,  hrR: 91,  runsL: 91,  runsR: 93  }, // loanDepot park
  147: { hrL: 106, hrR: 110, runsL: 103, runsR: 104 }, // Yankee Stadium (short RF porch)
  158: { hrL: 102, hrR: 106, runsL: 100, runsR: 102 }, // American Family Field
};

/**
 * Get park factor for a specific batter handedness.
 * Returns the standard park factor if handedness splits aren't available.
 */
export function getParkFactorForHandedness(
  teamId: number,
  batterHand: "L" | "R" | "S" | null
): { hr: number; runs: number } {
  const splits = PARK_FACTOR_SPLITS[teamId];
  if (!splits) {
    const base = STADIUM_DATA[teamId];
    return { hr: base?.parkFactorHR ?? 100, runs: base?.parkFactorRuns ?? 100 };
  }
  if (batterHand === "L") return { hr: splits.hrL, runs: splits.runsL };
  if (batterHand === "R") return { hr: splits.hrR, runs: splits.runsR };
  // Switch hitter or unknown: average of L and R
  return {
    hr: Math.round((splits.hrL + splits.hrR) / 2),
    runs: Math.round((splits.runsL + splits.runsR) / 2),
  };
}
