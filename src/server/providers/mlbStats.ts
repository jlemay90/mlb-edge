import { type FinalGameResult, type FinalGameStatus } from "../../domain/grading.js";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type ProviderRequestUsage = {
  requestsRemaining?: string;
  requestsUsed?: string;
  requestsLast?: string;
};

export type ProviderResult<T> =
  | { ok: true; data: T; requestUsage?: ProviderRequestUsage }
  | { ok: false; error: string; status?: number; requestUsage?: ProviderRequestUsage };

export type MlbScheduledGame = {
  gameId: string;
  gameDate: string;
  officialDate?: string;
  status: "scheduled" | "final" | "postponed" | "suspended" | "cancelled" | "pending";
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  homeScore?: number;
  awayScore?: number;
  homeProbablePitcher?: string;
  awayProbablePitcher?: string;
  homeProbablePitcherId?: number;
  awayProbablePitcherId?: number;
  venue?: string;
  venueId?: string;
  venueLatitude?: number;
  venueLongitude?: number;
  venueAzimuthAngle?: number;
};

export type MlbPitcherGameLogEntry = {
  playerId: number;
  playerName: string;
  season: number;
  gamePk: number;
  date: string;
  gamesStarted: number;
  outs: number;
  inningsPitched: string;
  homeRuns: number;
  strikeOuts: number;
  baseOnBalls: number;
  hitByPitch: number;
  earnedRuns: number;
};

export type MlbScheduleRangeRequest = {
  startDate: string;
  endDate: string;
  gameTypes?: string;
};

const MLB_BASE_URL = "https://statsapi.mlb.com/api/v1";

export async function fetchMlbSchedule(
  date: string,
  fetchImpl: FetchLike = fetch
): Promise<ProviderResult<MlbScheduledGame[]>> {
  const schedule = await fetchScheduleBody({ date }, fetchImpl);

  if (!schedule.ok) {
    return schedule;
  }

  return {
    ok: true,
    data: extractGames(schedule.data).map(normalizeScheduledGame),
  };
}

export async function fetchMlbScheduleRange(
  request: MlbScheduleRangeRequest,
  fetchImpl: FetchLike = fetch
): Promise<ProviderResult<MlbScheduledGame[]>> {
  const schedule = await fetchScheduleBody(request, fetchImpl);

  if (!schedule.ok) {
    return schedule;
  }

  return {
    ok: true,
    data: extractGames(schedule.data).map(normalizeScheduledGame),
  };
}

export async function fetchFinalScores(
  date: string,
  fetchImpl: FetchLike = fetch
): Promise<ProviderResult<FinalGameResult[]>> {
  const schedule = await fetchScheduleBody({ date }, fetchImpl);

  if (!schedule.ok) {
    return schedule;
  }

  const finals = extractGames(schedule.data)
    .map(normalizeFinalResult)
    .filter((result): result is FinalGameResult => result !== null);

  return { ok: true, data: finals };
}

export async function fetchMlbPitcherGameLog(
  playerId: number,
  season: number,
  fetchImpl: FetchLike = fetch
): Promise<ProviderResult<MlbPitcherGameLogEntry[]>> {
  const url = new URL(`${MLB_BASE_URL}/people/${playerId}/stats`);
  url.searchParams.set("stats", "gameLog");
  url.searchParams.set("group", "pitching");
  url.searchParams.set("season", String(season));
  url.searchParams.set("gameType", "R");

  try {
    const response = await fetchImpl(url.toString());
    if (!response.ok) {
      return {
        ok: false,
        error: `MLB pitcher game log request failed with status ${response.status}`,
        status: response.status,
      };
    }

    const body = await response.json();
    return {
      ok: true,
      data: extractPitcherGameLogSplits(body).map((split) => normalizePitcherGameLog(split, playerId, season)),
    };
  } catch (error) {
    return {
      ok: false,
      error: `MLB pitcher game log request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function buildScheduleUrl(request: { date?: string } | MlbScheduleRangeRequest): string {
  const url = new URL(`${MLB_BASE_URL}/schedule`);
  url.searchParams.set("sportId", "1");
  if ("date" in request && request.date) {
    url.searchParams.set("date", request.date);
  } else if ("startDate" in request) {
    url.searchParams.set("startDate", request.startDate);
    url.searchParams.set("endDate", request.endDate);
    url.searchParams.set("gameTypes", request.gameTypes ?? "R");
  }
  url.searchParams.set("hydrate", "linescore,probablePitcher,venue(location)");
  return url.toString();
}

async function fetchScheduleBody(
  request: { date?: string } | MlbScheduleRangeRequest,
  fetchImpl: FetchLike
): Promise<ProviderResult<unknown>> {
  const url = buildScheduleUrl(request);

  try {
    const response = await fetchImpl(url);
    if (!response.ok) {
      return {
        ok: false,
        error: `MLB Stats API request failed with status ${response.status}`,
        status: response.status,
      };
    }

    return {
      ok: true,
      data: await response.json(),
    };
  } catch (error) {
    return {
      ok: false,
      error: `MLB Stats API request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function extractGames(body: unknown): any[] {
  const dates = (body as { dates?: Array<{ games?: any[] }> }).dates ?? [];
  return dates.flatMap((date) => date.games ?? []);
}

function normalizeScheduledGame(game: any): MlbScheduledGame {
  return {
    gameId: String(game.gamePk),
    gameDate: game.gameDate ?? "",
    officialDate: game.officialDate,
    status: mapStatus(game.status?.abstractGameState, game.status?.detailedState),
    homeTeam: game.teams?.home?.team?.name ?? "",
    awayTeam: game.teams?.away?.team?.name ?? "",
    homeTeamId: game.teams?.home?.team?.id,
    awayTeamId: game.teams?.away?.team?.id,
    homeScore: game.teams?.home?.score,
    awayScore: game.teams?.away?.score,
    homeProbablePitcher: game.teams?.home?.probablePitcher?.fullName,
    awayProbablePitcher: game.teams?.away?.probablePitcher?.fullName,
    homeProbablePitcherId: numberOrUndefined(game.teams?.home?.probablePitcher?.id),
    awayProbablePitcherId: numberOrUndefined(game.teams?.away?.probablePitcher?.id),
    venue: game.venue?.name,
    venueId: game.venue?.id === undefined ? undefined : String(game.venue.id),
    venueLatitude: numberOrUndefined(game.venue?.location?.defaultCoordinates?.latitude),
    venueLongitude: numberOrUndefined(game.venue?.location?.defaultCoordinates?.longitude),
    venueAzimuthAngle: numberOrUndefined(game.venue?.location?.azimuthAngle),
  };
}

function extractPitcherGameLogSplits(body: unknown): any[] {
  return ((body as { stats?: Array<{ splits?: any[] }> }).stats ?? []).flatMap((stat) => stat.splits ?? []);
}

function normalizePitcherGameLog(split: any, fallbackPlayerId: number, fallbackSeason: number): MlbPitcherGameLogEntry {
  return {
    playerId: numberOrUndefined(split.player?.id) ?? fallbackPlayerId,
    playerName: split.player?.fullName ?? "",
    season: numberOrUndefined(Number(split.season)) ?? fallbackSeason,
    gamePk: numberOrUndefined(split.game?.gamePk) ?? 0,
    date: split.date ?? "",
    gamesStarted: numberOrUndefined(split.stat?.gamesStarted) ?? 0,
    outs: numberOrUndefined(split.stat?.outs) ?? 0,
    inningsPitched: split.stat?.inningsPitched ?? "",
    homeRuns: numberOrUndefined(split.stat?.homeRuns) ?? 0,
    strikeOuts: numberOrUndefined(split.stat?.strikeOuts) ?? 0,
    baseOnBalls: numberOrUndefined(split.stat?.baseOnBalls) ?? 0,
    hitByPitch: numberOrUndefined(split.stat?.hitByPitch) ?? 0,
    earnedRuns: numberOrUndefined(split.stat?.earnedRuns) ?? 0,
  };
}

function normalizeFinalResult(game: any): FinalGameResult | null {
  const status = mapStatus(game.status?.abstractGameState, game.status?.detailedState);

  if (status === "pending" || status === "scheduled") {
    return null;
  }

  return {
    gameId: String(game.gamePk),
    status,
    homeTeam: game.teams?.home?.team?.name ?? "",
    awayTeam: game.teams?.away?.team?.name ?? "",
    homeScore: status === "final" ? game.teams?.home?.score : undefined,
    awayScore: status === "final" ? game.teams?.away?.score : undefined,
  };
}

function mapStatus(abstractState?: string, detailedState?: string): FinalGameStatus | MlbScheduledGame["status"] {
  const detailed = (detailedState ?? "").toLowerCase();

  if (detailed.includes("postpon")) return "postponed";
  if (detailed.includes("suspend")) return "suspended";
  if (detailed.includes("cancel")) return "cancelled";
  if ((abstractState ?? "").toLowerCase() === "final") return "final";
  if (detailed.includes("scheduled")) return "scheduled";

  return "pending";
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
