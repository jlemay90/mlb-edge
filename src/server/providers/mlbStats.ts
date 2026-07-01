import { type FinalGameResult, type FinalGameStatus } from "../../domain/grading";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export type MlbScheduledGame = {
  gameId: string;
  gameDate: string;
  status: "scheduled" | "final" | "postponed" | "suspended" | "cancelled" | "pending";
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  homeProbablePitcher?: string;
  awayProbablePitcher?: string;
  venue?: string;
};

const MLB_BASE_URL = "https://statsapi.mlb.com/api/v1";

export async function fetchMlbSchedule(
  date: string,
  fetchImpl: FetchLike = fetch
): Promise<ProviderResult<MlbScheduledGame[]>> {
  const schedule = await fetchScheduleBody(date, fetchImpl);

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
  const schedule = await fetchScheduleBody(date, fetchImpl);

  if (!schedule.ok) {
    return schedule;
  }

  const finals = extractGames(schedule.data)
    .map(normalizeFinalResult)
    .filter((result): result is FinalGameResult => result !== null);

  return { ok: true, data: finals };
}

function buildScheduleUrl(date: string): string {
  const url = new URL(`${MLB_BASE_URL}/schedule`);
  url.searchParams.set("sportId", "1");
  url.searchParams.set("date", date);
  url.searchParams.set("hydrate", "linescore,probablePitcher");
  return url.toString();
}

async function fetchScheduleBody(date: string, fetchImpl: FetchLike): Promise<ProviderResult<unknown>> {
  const url = buildScheduleUrl(date);

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
    status: mapStatus(game.status?.abstractGameState, game.status?.detailedState),
    homeTeam: game.teams?.home?.team?.name ?? "",
    awayTeam: game.teams?.away?.team?.name ?? "",
    homeTeamId: game.teams?.home?.team?.id,
    awayTeamId: game.teams?.away?.team?.id,
    homeProbablePitcher: game.teams?.home?.probablePitcher?.fullName,
    awayProbablePitcher: game.teams?.away?.probablePitcher?.fullName,
    venue: game.venue?.name,
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
