import { type GameFeatures } from "../domain/projection";
import { type MlbPitcherGameLogEntry, type MlbScheduledGame } from "./providers/mlbStats";

export type HistoricalPregameContextRequest = {
  game: MlbScheduledGame;
  games: MlbScheduledGame[];
  minTeamGames?: number;
  minVenueGames?: number;
};

export type StarterPitchingContextRequest = {
  game: MlbScheduledGame;
  pitcherLogsById: Map<number, MlbPitcherGameLogEntry[]>;
  minStarterStarts?: number;
};

const DEFAULT_MIN_TEAM_GAMES = 5;
const DEFAULT_MIN_VENUE_GAMES = 20;
const DEFAULT_MIN_STARTER_STARTS = 3;
const FIP_PROXY_CONSTANT = 3.1;
const RECENT_GAME_LIMIT = 10;

export function buildHistoricalPregameContext(
  request: HistoricalPregameContextRequest
): Partial<GameFeatures> {
  const targetTime = new Date(request.game.gameDate).getTime();
  if (Number.isNaN(targetTime)) {
    return {};
  }

  const priorGames = request.games
    .filter((game) => isResolvedFinal(game) && new Date(game.gameDate).getTime() < targetTime)
    .sort((left, right) => new Date(left.gameDate).getTime() - new Date(right.gameDate).getTime());
  const leagueRunsPerTeam = runsPerTeam(priorGames);
  const context: Partial<GameFeatures> = {};

  if (leagueRunsPerTeam !== undefined) {
    Object.assign(
      context,
      teamContext({
        team: request.game.homeTeam,
        side: "home",
        targetGameDate: request.game.gameDate,
        priorGames,
        leagueRunsPerTeam,
        minTeamGames: request.minTeamGames ?? DEFAULT_MIN_TEAM_GAMES,
      }),
      teamContext({
        team: request.game.awayTeam,
        side: "away",
        targetGameDate: request.game.gameDate,
        priorGames,
        leagueRunsPerTeam,
        minTeamGames: request.minTeamGames ?? DEFAULT_MIN_TEAM_GAMES,
      }),
      venueContext({
        game: request.game,
        priorGames,
        leagueRunsPerTeam,
        minVenueGames: request.minVenueGames ?? DEFAULT_MIN_VENUE_GAMES,
      })
    );
  }

  return context;
}

export function buildStarterPitchingContext(
  request: StarterPitchingContextRequest
): Partial<GameFeatures> {
  return {
    homeStarterFip: starterFipBeforeGame({
      pitcherId: request.game.homeProbablePitcherId,
      gameDate: request.game.gameDate,
      pitcherLogsById: request.pitcherLogsById,
      minStarterStarts: request.minStarterStarts ?? DEFAULT_MIN_STARTER_STARTS,
    }),
    awayStarterFip: starterFipBeforeGame({
      pitcherId: request.game.awayProbablePitcherId,
      gameDate: request.game.gameDate,
      pitcherLogsById: request.pitcherLogsById,
      minStarterStarts: request.minStarterStarts ?? DEFAULT_MIN_STARTER_STARTS,
    }),
  };
}

function teamContext(input: {
  team: string;
  side: "home" | "away";
  targetGameDate: string;
  priorGames: MlbScheduledGame[];
  leagueRunsPerTeam: number;
  minTeamGames: number;
}): Partial<GameFeatures> {
  const games = input.priorGames.filter((game) => gameIncludesTeam(game, input.team));
  const prefix = input.side === "home" ? "home" : "away";
  const context: Partial<GameFeatures> = {};

  const previousGame = games.at(-1);
  if (previousGame) {
    context[`${prefix}BullpenRest` as "homeBullpenRest" | "awayBullpenRest"] = bullpenRestScore(
      previousGame.gameDate,
      input.targetGameDate
    );
  }

  if (games.length < input.minTeamGames) {
    return context;
  }

  const runsFor = games.reduce((total, game) => total + teamRunsFor(game, input.team), 0);
  const wrcPlusProxy = clamp((runsFor / games.length / input.leagueRunsPerTeam) * 100, 65, 140);
  const recentGames = games.slice(-RECENT_GAME_LIMIT);
  const recentForm =
    recentGames.reduce((total, game) => total + teamRunDifferential(game, input.team), 0) / recentGames.length;

  context[`${prefix}WrcPlus` as "homeWrcPlus" | "awayWrcPlus"] = Math.round(wrcPlusProxy);
  context[`${prefix}RecentForm` as "homeRecentForm" | "awayRecentForm"] = roundTo(
    clamp(recentForm, -3, 3),
    2
  );

  return context;
}

function venueContext(input: {
  game: MlbScheduledGame;
  priorGames: MlbScheduledGame[];
  leagueRunsPerTeam: number;
  minVenueGames: number;
}): Partial<GameFeatures> {
  const venueGames = input.priorGames.filter((game) => sameVenue(game, input.game));
  if (venueGames.length < input.minVenueGames) {
    return {};
  }

  const venueRunsPerGame =
    venueGames.reduce((total, game) => total + game.homeScore! + game.awayScore!, 0) / venueGames.length;
  const leagueRunsPerGame = input.leagueRunsPerTeam * 2;

  return {
    parkRunFactor: Math.round(clamp((venueRunsPerGame / leagueRunsPerGame) * 100, 80, 125)),
    parkFactorSource: `Pregame venue scoring history: ${venueGames.length} prior games at ${
      input.game.venue ?? "venue"
    }`,
  };
}

function starterFipBeforeGame(input: {
  pitcherId: number | undefined;
  gameDate: string;
  pitcherLogsById: Map<number, MlbPitcherGameLogEntry[]>;
  minStarterStarts: number;
}): number | undefined {
  if (input.pitcherId === undefined) {
    return undefined;
  }

  const targetDate = input.gameDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return undefined;
  }

  const priorStarts = (input.pitcherLogsById.get(input.pitcherId) ?? [])
    .filter((log) => log.gamesStarted > 0 && log.outs > 0 && log.date < targetDate)
    .sort((left, right) => left.date.localeCompare(right.date));
  if (priorStarts.length < input.minStarterStarts) {
    return undefined;
  }

  const totals = priorStarts.reduce(
    (sum, log) => ({
      outs: sum.outs + log.outs,
      homeRuns: sum.homeRuns + log.homeRuns,
      walks: sum.walks + log.baseOnBalls,
      hitByPitch: sum.hitByPitch + log.hitByPitch,
      strikeOuts: sum.strikeOuts + log.strikeOuts,
    }),
    { outs: 0, homeRuns: 0, walks: 0, hitByPitch: 0, strikeOuts: 0 }
  );
  if (totals.outs <= 0) {
    return undefined;
  }

  const innings = totals.outs / 3;
  const fip =
    ((13 * totals.homeRuns +
      3 * (totals.walks + totals.hitByPitch) -
      2 * totals.strikeOuts) /
      innings) +
    FIP_PROXY_CONSTANT;

  return roundTo(clamp(fip, 1.5, 9), 2);
}

function bullpenRestScore(previousGameDate: string, targetGameDate: string): number {
  const previous = new Date(previousGameDate).getTime();
  const target = new Date(targetGameDate).getTime();
  if (Number.isNaN(previous) || Number.isNaN(target)) {
    return 50;
  }

  const daysRest = Math.floor((target - previous) / (24 * 60 * 60 * 1000));
  if (daysRest <= 0) {
    return 25;
  }

  return Math.round(clamp(30 + Math.min(daysRest, 3) * 18.333, 25, 85));
}

function runsPerTeam(games: MlbScheduledGame[]): number | undefined {
  if (games.length === 0) {
    return undefined;
  }

  return games.reduce((total, game) => total + game.homeScore! + game.awayScore!, 0) / (games.length * 2);
}

function isResolvedFinal(game: MlbScheduledGame): boolean {
  return game.status === "final" && game.homeScore !== undefined && game.awayScore !== undefined;
}

function gameIncludesTeam(game: MlbScheduledGame, team: string): boolean {
  return sameName(game.homeTeam, team) || sameName(game.awayTeam, team);
}

function teamRunsFor(game: MlbScheduledGame, team: string): number {
  return sameName(game.homeTeam, team) ? game.homeScore! : game.awayScore!;
}

function teamRunsAgainst(game: MlbScheduledGame, team: string): number {
  return sameName(game.homeTeam, team) ? game.awayScore! : game.homeScore!;
}

function teamRunDifferential(game: MlbScheduledGame, team: string): number {
  return teamRunsFor(game, team) - teamRunsAgainst(game, team);
}

function sameVenue(left: MlbScheduledGame, right: MlbScheduledGame): boolean {
  if (left.venueId && right.venueId) {
    return left.venueId === right.venueId;
  }

  return sameName(left.venue ?? "", right.venue ?? "");
}

function sameName(left: string, right: string): boolean {
  return normalizeName(left) === normalizeName(right);
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
