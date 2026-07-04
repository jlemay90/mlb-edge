import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  fetchMlbScheduleRange,
  fetchMlbPitcherGameLog,
  type FetchLike,
  type MlbPitcherGameLogEntry,
  type MlbScheduledGame,
  type ProviderRequestUsage,
  type ProviderResult,
} from "./providers/mlbStats.js";
import { fetchHistoricalMlbOdds, type OddsBookmaker, type OddsEvent } from "./providers/oddsApi.js";
import {
  fetchHistoricalGameWeather,
  type GameWeather,
  type WeatherSource,
} from "./providers/weather.js";
import {
  buildHistoricalFeatureDraft,
  type HistoricalFeatureMissingSignal,
} from "./historicalFeatureDrafts.js";
import { buildHistoricalPregameContext } from "./historicalPregameFeatures.js";
import { buildStarterPitchingContext } from "./historicalPregameFeatures.js";

export type HistoricalSeasonImportReport = {
  season: number;
  status: "ready-for-odds" | "partial" | "blocked";
  games: number;
  finalResults: number;
  venueContexts: number;
  estimatedPregameOddsSnapshots: number;
  oddsSnapshotsCached: number;
  oddsSnapshotsChecked: number;
  oddsApiRequestsMade: number;
  oddsApiCreditsSpent: number;
  oddsSnapshotsFullMarket: number;
  oddsSnapshotsMoneylineOnly: number;
  oddsEventsSeen: number;
  weatherSnapshotsCached: number;
  weatherSnapshotsChecked: number;
  weatherSnapshotsFailed: number;
  pitcherLogsCached: number;
  pitcherLogsChecked: number;
  pitcherLogsFailed: number;
  featureSnapshotCandidates: number;
  featureDrafts: number;
  featureDraftMissingSignals: Partial<Record<HistoricalFeatureMissingSignal, number>>;
  nextOddsSnapshotTimes: string[];
  featureSnapshots: number;
  firstGameDate?: string;
  lastGameDate?: string;
  blockers: string[];
};

export type HistoricalImportReport = {
  generatedAt: string;
  seasons: number[];
  oddsApiConfigured: boolean;
  requestedMarkets: string[];
  maxOddsSnapshots: number;
  maxOddsApiCredits: number | null;
  apiCallLedgerPath: string;
  maxWeatherSnapshots: number | null;
  maxPitcherLogRequests: number | null;
  totals: {
    games: number;
    finalResults: number;
    venueContexts: number;
    estimatedPregameOddsSnapshots: number;
    oddsSnapshotsCached: number;
    oddsSnapshotsChecked: number;
    oddsApiRequestsMade: number;
    oddsApiCreditsSpent: number;
    oddsSnapshotsFullMarket: number;
    oddsSnapshotsMoneylineOnly: number;
    oddsEventsSeen: number;
    weatherSnapshotsCached: number;
    weatherSnapshotsChecked: number;
    weatherSnapshotsFailed: number;
    pitcherLogsCached: number;
    pitcherLogsChecked: number;
    pitcherLogsFailed: number;
    featureSnapshotCandidates: number;
    featureDrafts: number;
    featureDraftMissingSignals: Partial<Record<HistoricalFeatureMissingSignal, number>>;
    featureSnapshots: number;
  };
  seasonReports: HistoricalSeasonImportReport[];
  blockers: string[];
};

export type HistoricalImportRequest = {
  seasons?: number[];
  asOfDateIso?: string;
  oddsApiKey?: string;
  maxOddsSnapshots?: number;
  maxOddsApiCredits?: number;
  maxWeatherSnapshots?: number | null;
  maxPitcherLogRequests?: number | null;
  markets?: string[];
  cacheDir?: string;
  weatherCacheDir?: string;
  pitcherLogCacheDir?: string;
  apiCallLedgerPath?: string;
  fetchImpl?: FetchLike;
};

export type HistoricalApiCallLedgerEntry = {
  requestedAt: string;
  provider: "the-odds-api";
  endpoint: "historical-mlb-odds";
  season: number;
  isoTimestamp: string;
  markets: string[];
  status: "ok" | "error";
  creditsSpent: number;
  cachePath: string;
  eventCount?: number;
  httpStatus?: number;
  error?: string;
  requestUsage?: ProviderRequestUsage;
};

export type OddsCacheManifestSnapshot = {
  season: number;
  isoTimestamp: string;
  path: string;
  markets: string[];
  eventCount: number;
  fetchedAt?: string;
  sizeBytes: number;
};

export type OddsCacheManifest = {
  generatedAt: string;
  cacheDir: string;
  totals: {
    snapshots: number;
    fullMarketSnapshots: number;
    moneylineOnlySnapshots: number;
    events: number;
    sizeBytes: number;
  };
  snapshots: OddsCacheManifestSnapshot[];
};

const DEFAULT_AS_OF_DATE = "2026-07-01";
const DEFAULT_ODDS_MARKETS = ["h2h", "spreads", "totals"];
const DEFAULT_CACHE_DIR = "data/historical/odds-cache";
const DEFAULT_WEATHER_CACHE_DIR = "data/historical/weather-cache";
const DEFAULT_PITCHER_LOG_CACHE_DIR = "data/historical/pitcher-cache";
const DEFAULT_API_CALL_LEDGER_PATH = "data/historical/api-calls.jsonl";
const ODDS_API_MLB_HISTORICAL_START_SEASON = 2020;

export async function buildHistoricalImportReport(
  request: HistoricalImportRequest = {}
): Promise<HistoricalImportReport> {
  const seasons = request.seasons ?? getDefaultHistoricalMlbOddsSeasons(request.asOfDateIso ?? DEFAULT_AS_OF_DATE);
  const oddsApiKey = request.oddsApiKey?.trim() ?? "";
  const maxOddsSnapshots = request.maxOddsSnapshots ?? 0;
  const maxOddsApiCredits = request.maxOddsApiCredits;
  const maxWeatherSnapshots = request.maxWeatherSnapshots === undefined ? 0 : request.maxWeatherSnapshots;
  const maxPitcherLogRequests =
    request.maxPitcherLogRequests === undefined ? 0 : request.maxPitcherLogRequests;
  const markets = normalizeMarkets(request.markets);
  const cacheDir = request.cacheDir ?? DEFAULT_CACHE_DIR;
  const weatherCacheDir = request.weatherCacheDir ?? DEFAULT_WEATHER_CACHE_DIR;
  const pitcherLogCacheDir = request.pitcherLogCacheDir ?? DEFAULT_PITCHER_LOG_CACHE_DIR;
  const apiCallLedgerPath = request.apiCallLedgerPath ?? DEFAULT_API_CALL_LEDGER_PATH;
  let remainingOddsChecks = maxOddsSnapshots;
  let remainingOddsApiCredits = maxOddsApiCredits ?? Number.POSITIVE_INFINITY;
  let remainingWeatherChecks = maxWeatherSnapshots ?? Number.POSITIVE_INFINITY;
  let remainingPitcherLogChecks = maxPitcherLogRequests ?? Number.POSITIVE_INFINITY;

  const seasonReports: HistoricalSeasonImportReport[] = [];
  for (const season of seasons) {
    const schedule = await fetchMlbScheduleRange(
      {
        startDate: `${season}-03-01`,
        endDate: `${season}-11-30`,
        gameTypes: "R",
      },
      request.fetchImpl
    );

    if (!schedule.ok) {
      seasonReports.push(blockedSeasonReport(season, schedule));
      continue;
    }

    const oddsLimit = oddsApiKey ? remainingOddsChecks : 0;
    const report = await buildSeasonReport({
      season,
      games: schedule.data,
      oddsApiKey,
      maxOddsSnapshots: oddsLimit,
      markets,
      cacheDir,
      weatherCacheDir,
      pitcherLogCacheDir,
      apiCallLedgerPath,
      maxOddsApiCredits: remainingOddsApiCredits,
      maxWeatherSnapshots: remainingWeatherChecks,
      maxPitcherLogRequests: remainingPitcherLogChecks,
      fetchImpl: request.fetchImpl,
    });
    remainingOddsChecks = Math.max(0, remainingOddsChecks - report.oddsSnapshotsChecked);
    remainingOddsApiCredits = Math.max(0, remainingOddsApiCredits - report.oddsApiCreditsSpent);
    remainingWeatherChecks = Math.max(0, remainingWeatherChecks - report.weatherSnapshotsChecked);
    remainingPitcherLogChecks = Math.max(0, remainingPitcherLogChecks - report.pitcherLogsChecked);
    seasonReports.push(report);
  }

  const totals = sumSeasonReports(seasonReports);
  const blockers = buildReportBlockers({
    oddsApiConfigured: Boolean(oddsApiKey),
    maxOddsSnapshots,
    maxOddsApiCredits,
    seasonReports,
  });

  return {
    generatedAt: new Date().toISOString(),
    seasons,
    oddsApiConfigured: Boolean(oddsApiKey),
    requestedMarkets: markets,
    maxOddsSnapshots,
    maxOddsApiCredits: maxOddsApiCredits ?? null,
    apiCallLedgerPath,
    maxWeatherSnapshots,
    maxPitcherLogRequests,
    totals,
    seasonReports,
    blockers,
  };
}

export function getDefaultHistoricalMlbOddsSeasons(asOfDateIso: string): number[] {
  const asOf = new Date(`${asOfDateIso}T00:00:00Z`);
  if (Number.isNaN(asOf.getTime())) {
    throw new Error("asOfDateIso must be a valid YYYY-MM-DD date");
  }

  const currentYear = asOf.getUTCFullYear();
  const currentSeasonIsComplete = asOf.getUTCMonth() >= 10;
  const endSeason = currentSeasonIsComplete ? currentYear : currentYear - 1;
  if (endSeason < ODDS_API_MLB_HISTORICAL_START_SEASON) {
    return [];
  }

  return Array.from(
    { length: endSeason - ODDS_API_MLB_HISTORICAL_START_SEASON + 1 },
    (_value, index) => ODDS_API_MLB_HISTORICAL_START_SEASON + index
  );
}

export function writeHistoricalImportReport(report: HistoricalImportReport, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export function buildOddsCacheManifest(cacheDir: string): OddsCacheManifest {
  const snapshots = listOddsCacheFiles(cacheDir).flatMap((path) => {
    try {
      const cached = JSON.parse(readFileSync(path, "utf8")) as {
        isoTimestamp?: string;
        fetchedAt?: string;
        markets?: string[];
        events?: unknown[];
      };
      const season = Number(dirname(path).split(/[\\/]/).pop());
      if (!Number.isInteger(season) || !cached.isoTimestamp) {
        return [];
      }

      return [
        {
          season,
          isoTimestamp: cached.isoTimestamp,
          path,
          markets: cached.markets ?? DEFAULT_ODDS_MARKETS,
          eventCount: cached.events?.length ?? 0,
          fetchedAt: cached.fetchedAt,
          sizeBytes: statSync(path).size,
        },
      ];
    } catch {
      return [];
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    cacheDir,
    totals: {
      snapshots: snapshots.length,
      fullMarketSnapshots: snapshots.filter((snapshot) => isFullMarketSnapshot(snapshot.markets)).length,
      moneylineOnlySnapshots: snapshots.filter((snapshot) => isMoneylineOnlyRequest(snapshot.markets)).length,
      events: snapshots.reduce((total, snapshot) => total + snapshot.eventCount, 0),
      sizeBytes: snapshots.reduce((total, snapshot) => total + snapshot.sizeBytes, 0),
    },
    snapshots: snapshots.sort((left, right) =>
      left.season === right.season
        ? left.isoTimestamp.localeCompare(right.isoTimestamp)
        : left.season - right.season
    ),
  };
}

export function writeOddsCacheManifest(manifest: OddsCacheManifest, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function buildSeasonReport(input: {
  season: number;
  games: MlbScheduledGame[];
  oddsApiKey: string;
  maxOddsSnapshots: number;
  markets: string[];
  cacheDir: string;
  weatherCacheDir: string;
  pitcherLogCacheDir: string;
  apiCallLedgerPath: string;
  maxOddsApiCredits: number;
  maxWeatherSnapshots: number;
  maxPitcherLogRequests: number;
  fetchImpl?: FetchLike;
}): Promise<HistoricalSeasonImportReport> {
  const finalResults = input.games.filter(isResolvedForGrading).length;
  const venueContexts = input.games.filter((game) => game.venue).length;
  const snapshotTimes = getUniquePregameSnapshotTimes(input.games);
  const oddsCheck = await checkOddsSnapshots({
    apiKey: input.oddsApiKey,
    season: input.season,
    snapshotTimes,
    maxOddsSnapshots: input.maxOddsSnapshots,
    maxOddsApiCredits: input.maxOddsApiCredits,
    markets: input.markets,
    cacheDir: input.cacheDir,
    apiCallLedgerPath: input.apiCallLedgerPath,
    fetchImpl: input.fetchImpl,
  });
  const pitcherLogs = await loadSeasonPitcherLogs({
    season: input.season,
    games: input.games,
    pitcherLogCacheDir: input.pitcherLogCacheDir,
    maxPitcherLogRequests: input.maxPitcherLogRequests,
    fetchImpl: input.fetchImpl,
  });
  const featureDraftSummary = await summarizeFeatureDrafts({
    games: input.games,
    season: input.season,
    cacheDir: input.cacheDir,
    weatherCacheDir: input.weatherCacheDir,
    pitcherLogsById: pitcherLogs.logsById,
    maxWeatherSnapshots: input.maxWeatherSnapshots,
    fetchImpl: input.fetchImpl,
  });
  const featureSnapshotCandidates = featureDraftSummary.featureDrafts;
  const featureSnapshots = featureDraftSummary.featureSnapshots;
  const blockers = buildSeasonBlockers({
    games: input.games.length,
    finalResults,
    venueContexts,
    snapshotTimes,
    oddsApiConfigured: Boolean(input.oddsApiKey),
    oddsCheck,
    featureSnapshots,
  });

  return {
    season: input.season,
    status: blockers.length > 0 ? (input.oddsApiKey ? "partial" : "blocked") : "ready-for-odds",
    games: input.games.length,
    finalResults,
    venueContexts,
    estimatedPregameOddsSnapshots: snapshotTimes.length,
    oddsSnapshotsCached: oddsCheck.cached,
    oddsSnapshotsChecked: oddsCheck.checked,
    oddsApiRequestsMade: oddsCheck.apiRequestsMade,
    oddsApiCreditsSpent: oddsCheck.apiCreditsSpent,
    oddsSnapshotsFullMarket: oddsCheck.fullMarket,
    oddsSnapshotsMoneylineOnly: oddsCheck.moneylineOnly,
    oddsEventsSeen: oddsCheck.eventsSeen,
    weatherSnapshotsCached: featureDraftSummary.weatherCached,
    weatherSnapshotsChecked: featureDraftSummary.weatherChecked,
    weatherSnapshotsFailed: featureDraftSummary.weatherFailed,
    pitcherLogsCached: pitcherLogs.cached,
    pitcherLogsChecked: pitcherLogs.checked,
    pitcherLogsFailed: pitcherLogs.failed,
    featureSnapshotCandidates,
    featureDrafts: featureDraftSummary.featureDrafts,
    featureDraftMissingSignals: featureDraftSummary.missingSignals,
    nextOddsSnapshotTimes: oddsCheck.nextUncached,
    featureSnapshots,
    firstGameDate: input.games[0]?.officialDate ?? input.games[0]?.gameDate.slice(0, 10),
    lastGameDate:
      input.games[input.games.length - 1]?.officialDate ??
      input.games[input.games.length - 1]?.gameDate.slice(0, 10),
    blockers,
  };
}

async function checkOddsSnapshots(input: {
  apiKey: string;
  season: number;
  snapshotTimes: string[];
  maxOddsSnapshots: number;
  maxOddsApiCredits: number;
  markets: string[];
  cacheDir: string;
  apiCallLedgerPath: string;
  fetchImpl?: FetchLike;
}): Promise<{
  cached: number;
  checked: number;
  apiRequestsMade: number;
  apiCreditsSpent: number;
  fullMarket: number;
  moneylineOnly: number;
  eventsSeen: number;
  errors: string[];
  nextUncached: string[];
}> {
  const errors: string[] = [];
  const nextUncached: string[] = [];
  let cached = 0;
  let checked = 0;
  let apiRequestsMade = 0;
  let apiCreditsSpent = 0;
  let fullMarket = 0;
  let moneylineOnly = 0;
  let eventsSeen = 0;
  let remainingUsableChecks = input.maxOddsSnapshots;
  let remainingApiCredits = input.maxOddsApiCredits;
  let remainingFailedSnapshotSkips = Math.max(25, input.maxOddsSnapshots * 20);

  for (const isoTimestamp of input.snapshotTimes) {
    const cachedSnapshot = readCachedOddsSnapshot(input.cacheDir, input.season, isoTimestamp);
    if (cachedSnapshot) {
      cached += 1;
      if (isFullMarketSnapshot(cachedSnapshot.markets)) {
        fullMarket += 1;
      } else {
        moneylineOnly += 1;
      }
      eventsSeen += cachedSnapshot.eventCount;
      continue;
    }

    if (!input.apiKey || remainingUsableChecks <= 0 || remainingFailedSnapshotSkips <= 0) {
      if (nextUncached.length < 5) {
        nextUncached.push(isoTimestamp);
      }
      continue;
    }

    const primaryOdds = await callHistoricalOddsWithAccounting({
      apiKey: input.apiKey,
      season: input.season,
      isoTimestamp,
      markets: input.markets,
      cacheDir: input.cacheDir,
      apiCallLedgerPath: input.apiCallLedgerPath,
      fetchImpl: input.fetchImpl,
      remainingApiCredits,
    });
    if (primaryOdds.status === "skipped-budget") {
      if (nextUncached.length < 5) {
        nextUncached.push(isoTimestamp);
      }
      continue;
    }
    remainingApiCredits -= primaryOdds.creditsSpent;
    apiCreditsSpent += primaryOdds.creditsSpent;
    apiRequestsMade += 1;
    let odds = primaryOdds.result;

    if (!odds.ok && odds.status === 401 && !isMoneylineOnlyRequest(input.markets)) {
      const fallbackOdds = await callHistoricalOddsWithAccounting({
        apiKey: input.apiKey,
        season: input.season,
        isoTimestamp,
        markets: ["h2h"],
        cacheDir: input.cacheDir,
        apiCallLedgerPath: input.apiCallLedgerPath,
        fetchImpl: input.fetchImpl,
        remainingApiCredits,
      });
      if (fallbackOdds.status === "skipped-budget") {
        if (nextUncached.length < 5) {
          nextUncached.push(isoTimestamp);
        }
        continue;
      }
      remainingApiCredits -= fallbackOdds.creditsSpent;
      apiCreditsSpent += fallbackOdds.creditsSpent;
      apiRequestsMade += 1;
      odds = fallbackOdds.result;
    }

    if (odds.ok) {
      remainingUsableChecks -= 1;
      checked += 1;
      const snapshotMarkets = determineSnapshotMarkets(odds.data, input.markets);
      if (isFullMarketSnapshot(snapshotMarkets)) {
        fullMarket += 1;
      } else if (hasAllRequestedMarkets(odds.data, ["h2h"])) {
        moneylineOnly += 1;
      }
      eventsSeen += odds.data.length;
      writeCachedOddsSnapshot(
        input.cacheDir,
        input.season,
        isoTimestamp,
        odds.data,
        snapshotMarkets
      );
    } else {
      remainingFailedSnapshotSkips -= 1;
      errors.push(`${isoTimestamp}: ${odds.error}`);
    }
  }

  return {
    cached,
    checked,
    apiRequestsMade,
    apiCreditsSpent,
    fullMarket,
    moneylineOnly,
    eventsSeen,
    errors,
    nextUncached,
  };
}

async function callHistoricalOddsWithAccounting(input: {
  apiKey: string;
  season: number;
  isoTimestamp: string;
  markets: string[];
  cacheDir: string;
  apiCallLedgerPath: string;
  remainingApiCredits: number;
  fetchImpl?: FetchLike;
}): Promise<
  | { status: "called"; result: ProviderResult<OddsEvent[]>; creditsSpent: number }
  | { status: "skipped-budget" }
> {
  const estimatedCredits = estimateOddsApiCredits(input.markets);
  if (input.remainingApiCredits < estimatedCredits) {
    return { status: "skipped-budget" };
  }

  const result = await fetchHistoricalMlbOdds({
    apiKey: input.apiKey,
    isoTimestamp: input.isoTimestamp,
    markets: input.markets,
    fetchImpl: input.fetchImpl,
  });
  const creditsSpent = determineOddsApiCreditsSpent(result.requestUsage, estimatedCredits);
  appendHistoricalApiCallLedger(input.apiCallLedgerPath, {
    requestedAt: new Date().toISOString(),
    provider: "the-odds-api",
    endpoint: "historical-mlb-odds",
    season: input.season,
    isoTimestamp: input.isoTimestamp,
    markets: input.markets,
    status: result.ok ? "ok" : "error",
    creditsSpent,
    cachePath: oddsCachePath(input.cacheDir, input.season, input.isoTimestamp),
    eventCount: result.ok ? result.data.length : undefined,
    httpStatus: result.ok ? undefined : result.status,
    error: result.ok ? undefined : result.error,
    requestUsage: result.requestUsage,
  });

  return { status: "called", result, creditsSpent };
}

async function loadSeasonPitcherLogs(input: {
  season: number;
  games: MlbScheduledGame[];
  pitcherLogCacheDir: string;
  maxPitcherLogRequests: number;
  fetchImpl?: FetchLike;
}): Promise<{
  logsById: Map<number, MlbPitcherGameLogEntry[]>;
  cached: number;
  checked: number;
  failed: number;
}> {
  const logsById = new Map<number, MlbPitcherGameLogEntry[]>();
  let cached = 0;
  let checked = 0;
  let failed = 0;
  let remainingChecks = input.maxPitcherLogRequests;
  const pitcherIds = uniquePitcherIds(input.games);

  for (const pitcherId of pitcherIds) {
    const cachedLogs = readCachedPitcherGameLog(input.pitcherLogCacheDir, input.season, pitcherId);
    if (cachedLogs) {
      logsById.set(pitcherId, cachedLogs);
      cached += 1;
      continue;
    }

    if (remainingChecks <= 0) {
      continue;
    }

    const result = await fetchMlbPitcherGameLog(pitcherId, input.season, input.fetchImpl);
    remainingChecks -= 1;
    if (result.ok) {
      logsById.set(pitcherId, result.data);
      writeCachedPitcherGameLog(input.pitcherLogCacheDir, input.season, pitcherId, result.data);
      checked += 1;
    } else {
      failed += 1;
    }
  }

  return { logsById, cached, checked, failed };
}

function uniquePitcherIds(games: MlbScheduledGame[]): number[] {
  return [
    ...new Set(
      games.flatMap((game) => [game.homeProbablePitcherId, game.awayProbablePitcherId])
        .filter((value): value is number => value !== undefined)
    ),
  ].sort((left, right) => left - right);
}

function readCachedPitcherGameLog(
  pitcherLogCacheDir: string,
  season: number,
  pitcherId: number
): MlbPitcherGameLogEntry[] | undefined {
  const path = pitcherLogCachePath(pitcherLogCacheDir, season, pitcherId);
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    const cached = JSON.parse(readFileSync(path, "utf8")) as { logs?: MlbPitcherGameLogEntry[] };
    return cached.logs ?? [];
  } catch {
    return undefined;
  }
}

function writeCachedPitcherGameLog(
  pitcherLogCacheDir: string,
  season: number,
  pitcherId: number,
  logs: MlbPitcherGameLogEntry[]
): void {
  const path = pitcherLogCachePath(pitcherLogCacheDir, season, pitcherId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        season,
        pitcherId,
        fetchedAt: new Date().toISOString(),
        source: "mlb-stats-game-log",
        logs,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function pitcherLogCachePath(pitcherLogCacheDir: string, season: number, pitcherId: number): string {
  return join(pitcherLogCacheDir, String(season), `${pitcherId}.json`);
}

function appendHistoricalApiCallLedger(path: string, entry: HistoricalApiCallLedgerEntry): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
}

function estimateOddsApiCredits(markets: string[]): number {
  return Math.max(10, markets.length * 10);
}

function determineOddsApiCreditsSpent(
  requestUsage: ProviderRequestUsage | undefined,
  fallbackEstimate: number
): number {
  const parsed = Number(requestUsage?.requestsLast);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackEstimate;
}

function blockedSeasonReport(
  season: number,
  result: ProviderResult<MlbScheduledGame[]>
): HistoricalSeasonImportReport {
  return {
    season,
    status: "blocked",
    games: 0,
    finalResults: 0,
    venueContexts: 0,
    estimatedPregameOddsSnapshots: 0,
    oddsSnapshotsCached: 0,
    oddsSnapshotsChecked: 0,
    oddsApiRequestsMade: 0,
    oddsApiCreditsSpent: 0,
    oddsSnapshotsFullMarket: 0,
    oddsSnapshotsMoneylineOnly: 0,
    oddsEventsSeen: 0,
    weatherSnapshotsCached: 0,
    weatherSnapshotsChecked: 0,
    weatherSnapshotsFailed: 0,
    pitcherLogsCached: 0,
    pitcherLogsChecked: 0,
    pitcherLogsFailed: 0,
    featureSnapshotCandidates: 0,
    featureDrafts: 0,
    featureDraftMissingSignals: {},
    nextOddsSnapshotTimes: [],
    featureSnapshots: 0,
    blockers: [result.ok ? "Unknown MLB schedule import failure." : result.error],
  };
}

function getUniquePregameSnapshotTimes(games: MlbScheduledGame[]): string[] {
  const times = games
    .map((game) => buildPregameSnapshotTime(game.gameDate))
    .filter((value): value is string => value !== undefined);

  return [...new Set(times)].sort();
}

function buildPregameSnapshotTime(gameDateIso: string): string | undefined {
  const firstPitch = new Date(gameDateIso);
  if (Number.isNaN(firstPitch.getTime())) {
    return undefined;
  }

  const snapshot = new Date(firstPitch.getTime() - 2 * 60 * 60 * 1000);
  snapshot.setUTCMinutes(0, 0, 0);
  return snapshot.toISOString().replace(".000Z", "Z");
}

function isResolvedForGrading(game: MlbScheduledGame): boolean {
  return (
    (game.status === "final" && game.homeScore !== undefined && game.awayScore !== undefined) ||
    game.status === "postponed" ||
    game.status === "suspended" ||
    game.status === "cancelled"
  );
}

function buildSeasonBlockers(input: {
  games: number;
  finalResults: number;
  venueContexts: number;
  snapshotTimes: string[];
  oddsApiConfigured: boolean;
  oddsCheck: { cached: number; checked: number; fullMarket: number; moneylineOnly: number; errors: string[] };
  featureSnapshots: number;
}): string[] {
  return [
    input.games === 0 ? "No MLB regular-season games were imported." : undefined,
    input.finalResults < input.games
      ? `${input.games - input.finalResults} games are missing final scores.`
      : undefined,
    input.venueContexts < input.games
      ? `${input.games - input.venueContexts} games are missing venue context.`
      : undefined,
    input.oddsApiConfigured
      ? undefined
      : "ODDS_API_KEY is not configured locally, so historical odds snapshots were not pulled.",
    input.oddsApiConfigured && input.oddsCheck.checked === 0 && input.oddsCheck.cached === 0
      ? "Historical odds key is configured, but this run did not request odds checks. Re-run with --max-odds."
      : undefined,
    input.oddsCheck.errors.length > 0
      ? `${input.oddsCheck.errors.length} historical odds snapshot checks failed.`
      : undefined,
    input.oddsCheck.moneylineOnly > 0
      ? `${input.oddsCheck.moneylineOnly} historical odds snapshots are moneyline-only; totals and run-line replay cannot use those snapshots.`
      : undefined,
    input.featureSnapshots < input.games
      ? "Feature snapshots are not complete yet; season-to-date offense, starter, bullpen, lineup, recent-form, weather, park, and odds inputs must be frozen before replay."
      : undefined,
  ].filter((blocker): blocker is string => blocker !== undefined);
}

function buildReportBlockers(input: {
  oddsApiConfigured: boolean;
  maxOddsSnapshots: number;
  maxOddsApiCredits: number | undefined;
  seasonReports: HistoricalSeasonImportReport[];
}): string[] {
  const totalCreditsSpent = input.seasonReports.reduce(
    (total, season) => total + season.oddsApiCreditsSpent,
    0
  );
  const hasRemainingUncachedOdds = input.seasonReports.some((season) => season.nextOddsSnapshotTimes.length > 0);
  const blockers = [
    input.oddsApiConfigured ? undefined : "Add ODDS_API_KEY to local .env before pulling historical odds.",
    input.oddsApiConfigured && input.maxOddsSnapshots === 0
      ? "Run with --max-odds to use paid historical odds quota."
      : undefined,
    input.maxOddsApiCredits !== undefined &&
    totalCreditsSpent >= input.maxOddsApiCredits &&
    hasRemainingUncachedOdds
      ? `Odds API credit budget reached at ${totalCreditsSpent}/${input.maxOddsApiCredits}; cached snapshots are preserved and remaining snapshots were not requested.`
      : undefined,
    "Complete the feature-snapshot builder before claiming a verified five-season model backtest.",
  ];

  return [
    ...blockers,
    ...input.seasonReports.flatMap((season) =>
      season.blockers.map((blocker) => `${season.season}: ${blocker}`)
    ),
  ].filter((blocker): blocker is string => blocker !== undefined);
}

function sumSeasonReports(seasonReports: HistoricalSeasonImportReport[]): HistoricalImportReport["totals"] {
  return seasonReports.reduce(
    (totals, report) => ({
      games: totals.games + report.games,
      finalResults: totals.finalResults + report.finalResults,
      venueContexts: totals.venueContexts + report.venueContexts,
      estimatedPregameOddsSnapshots:
        totals.estimatedPregameOddsSnapshots + report.estimatedPregameOddsSnapshots,
      oddsSnapshotsCached: totals.oddsSnapshotsCached + report.oddsSnapshotsCached,
      oddsSnapshotsChecked: totals.oddsSnapshotsChecked + report.oddsSnapshotsChecked,
      oddsApiRequestsMade: totals.oddsApiRequestsMade + report.oddsApiRequestsMade,
      oddsApiCreditsSpent: totals.oddsApiCreditsSpent + report.oddsApiCreditsSpent,
      oddsSnapshotsFullMarket: totals.oddsSnapshotsFullMarket + report.oddsSnapshotsFullMarket,
      oddsSnapshotsMoneylineOnly:
        totals.oddsSnapshotsMoneylineOnly + report.oddsSnapshotsMoneylineOnly,
      oddsEventsSeen: totals.oddsEventsSeen + report.oddsEventsSeen,
      weatherSnapshotsCached: totals.weatherSnapshotsCached + report.weatherSnapshotsCached,
      weatherSnapshotsChecked: totals.weatherSnapshotsChecked + report.weatherSnapshotsChecked,
      weatherSnapshotsFailed: totals.weatherSnapshotsFailed + report.weatherSnapshotsFailed,
      pitcherLogsCached: totals.pitcherLogsCached + report.pitcherLogsCached,
      pitcherLogsChecked: totals.pitcherLogsChecked + report.pitcherLogsChecked,
      pitcherLogsFailed: totals.pitcherLogsFailed + report.pitcherLogsFailed,
      featureSnapshotCandidates:
        totals.featureSnapshotCandidates + report.featureSnapshotCandidates,
      featureDrafts: totals.featureDrafts + report.featureDrafts,
      featureDraftMissingSignals: addMissingSignalCounts(
        totals.featureDraftMissingSignals,
        report.featureDraftMissingSignals
      ),
      featureSnapshots: totals.featureSnapshots + report.featureSnapshots,
    }),
    {
      games: 0,
      finalResults: 0,
      venueContexts: 0,
      estimatedPregameOddsSnapshots: 0,
      oddsSnapshotsCached: 0,
      oddsSnapshotsChecked: 0,
      oddsApiRequestsMade: 0,
      oddsApiCreditsSpent: 0,
      oddsSnapshotsFullMarket: 0,
      oddsSnapshotsMoneylineOnly: 0,
      oddsEventsSeen: 0,
      weatherSnapshotsCached: 0,
      weatherSnapshotsChecked: 0,
      weatherSnapshotsFailed: 0,
      pitcherLogsCached: 0,
      pitcherLogsChecked: 0,
      pitcherLogsFailed: 0,
      featureSnapshotCandidates: 0,
      featureDrafts: 0,
      featureDraftMissingSignals: {},
      featureSnapshots: 0,
    }
  );
}

function readCachedOddsSnapshot(
  cacheDir: string,
  season: number,
  isoTimestamp: string
): { eventCount: number; events: OddsEvent[]; markets: string[] } | undefined {
  const path = oddsCachePath(cacheDir, season, isoTimestamp);
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    const cached = JSON.parse(readFileSync(path, "utf8")) as { events?: unknown[]; markets?: string[] };
    const events = (cached.events ?? []).map(normalizeCachedOddsEvent);
    return { eventCount: events.length, events, markets: cached.markets ?? DEFAULT_ODDS_MARKETS };
  } catch {
    return undefined;
  }
}

async function summarizeFeatureDrafts(input: {
  games: MlbScheduledGame[];
  season: number;
  cacheDir: string;
  weatherCacheDir: string;
  pitcherLogsById: Map<number, MlbPitcherGameLogEntry[]>;
  maxWeatherSnapshots: number;
  fetchImpl?: FetchLike;
}): Promise<{
  featureDrafts: number;
  featureSnapshots: number;
  weatherCached: number;
  weatherChecked: number;
  weatherFailed: number;
  missingSignals: Partial<Record<HistoricalFeatureMissingSignal, number>>;
}> {
  const summary = {
    featureDrafts: 0,
    featureSnapshots: 0,
    weatherCached: 0,
    weatherChecked: 0,
    weatherFailed: 0,
    missingSignals: {} as Partial<Record<HistoricalFeatureMissingSignal, number>>,
  };
  let remainingWeatherChecks = input.maxWeatherSnapshots;

  for (const game of input.games) {
    if (!isResolvedForGrading(game) || !game.venue) {
      continue;
    }

    const isoTimestamp = buildPregameSnapshotTime(game.gameDate);
    if (!isoTimestamp) {
      continue;
    }

    const cachedSnapshot = readCachedOddsSnapshot(input.cacheDir, input.season, isoTimestamp);
    if (!cachedSnapshot) {
      continue;
    }

    const pregameContext = buildHistoricalPregameContext({
      game,
      games: input.games,
    });
    const starterContext = buildStarterPitchingContext({
      game,
      pitcherLogsById: input.pitcherLogsById,
    });
    const baseDraft = buildHistoricalFeatureDraft({
      game,
      oddsEvents: cachedSnapshot.events,
      oddsSnapshotTime: isoTimestamp,
      pregameContext: {
        ...pregameContext,
        ...starterContext,
      },
    });
    if (!baseDraft) {
      continue;
    }

    const weatherSnapshot = await readOrFetchHistoricalWeather({
      game,
      season: input.season,
      weatherCacheDir: input.weatherCacheDir,
      canFetchWeather: remainingWeatherChecks > 0,
      fetchImpl: input.fetchImpl,
    });
    if (weatherSnapshot.status === "cached") {
      summary.weatherCached += 1;
    } else if (weatherSnapshot.status === "checked") {
      summary.weatherChecked += 1;
      summary.weatherCached += 1;
      remainingWeatherChecks -= 1;
    } else if (weatherSnapshot.status === "failed") {
      summary.weatherFailed += 1;
      remainingWeatherChecks -= 1;
    }
    const weatherRunImpact =
      weatherSnapshot.status === "cached" || weatherSnapshot.status === "checked"
        ? weatherSnapshot.weather.weatherRunImpact
        : undefined;

    const draft = buildHistoricalFeatureDraft({
      game,
      oddsEvents: cachedSnapshot.events,
      oddsSnapshotTime: isoTimestamp,
      pregameContext: {
        ...pregameContext,
        ...starterContext,
      },
      weatherRunImpact,
    }) ?? baseDraft;

    summary.featureDrafts += 1;
    if (draft.missingSignals.length === 0) {
      summary.featureSnapshots += 1;
    }
    for (const signal of draft.missingSignals) {
      summary.missingSignals[signal] = (summary.missingSignals[signal] ?? 0) + 1;
    }
  }

  return summary;
}

async function readOrFetchHistoricalWeather(input: {
  game: MlbScheduledGame;
  season: number;
  weatherCacheDir: string;
  canFetchWeather: boolean;
  fetchImpl?: FetchLike;
}): Promise<
  | { status: "cached"; weather: CachedHistoricalWeather }
  | { status: "checked"; weather: CachedHistoricalWeather }
  | { status: "failed"; error: string }
  | { status: "missing" }
> {
  const cached = readCachedHistoricalWeather(input.weatherCacheDir, input.season, input.game.gameId);
  if (cached) {
    return { status: "cached", weather: cached };
  }

  if (!input.canFetchWeather) {
    return { status: "missing" };
  }

  if (input.game.venueLatitude === undefined || input.game.venueLongitude === undefined) {
    return { status: "failed", error: "Venue coordinates are unavailable." };
  }

  const weather = await fetchHistoricalGameWeather({
    latitude: input.game.venueLatitude,
    longitude: input.game.venueLongitude,
    firstPitchIso: input.game.gameDate,
    fetchImpl: input.fetchImpl,
  });
  if (!weather.ok) {
    return { status: "failed", error: weather.error };
  }

  const cachedWeather = {
    gameId: input.game.gameId,
    firstPitchIso: input.game.gameDate,
    source: weather.data.source,
    observedAt: weather.data.observedAt,
    temperatureF: weather.data.temperatureF,
    windSpeedMph: weather.data.windSpeedMph,
    windDirection: weather.data.windDirection,
    weatherRunImpact: estimateWeatherRunImpact(weather.data, input.game.venueAzimuthAngle),
  };
  writeCachedHistoricalWeather(input.weatherCacheDir, input.season, cachedWeather);
  return { status: "checked", weather: cachedWeather };
}

type CachedHistoricalWeather = {
  gameId: string;
  firstPitchIso: string;
  source: WeatherSource;
  observedAt?: string;
  temperatureF?: number;
  windSpeedMph?: number;
  windDirection?: string;
  weatherRunImpact: number;
};

function readCachedHistoricalWeather(
  weatherCacheDir: string,
  season: number,
  gameId: string
): CachedHistoricalWeather | undefined {
  const path = historicalWeatherCachePath(weatherCacheDir, season, gameId);
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    const cached = JSON.parse(readFileSync(path, "utf8")) as CachedHistoricalWeather;
    return typeof cached.weatherRunImpact === "number" ? cached : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedHistoricalWeather(
  weatherCacheDir: string,
  season: number,
  weather: CachedHistoricalWeather
): void {
  const path = historicalWeatherCachePath(weatherCacheDir, season, weather.gameId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        ...weather,
        fetchedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function historicalWeatherCachePath(weatherCacheDir: string, season: number, gameId: string): string {
  return join(weatherCacheDir, String(season), `${gameId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
}

function estimateWeatherRunImpact(weather: GameWeather, venueAzimuthAngle: number | undefined): number {
  const temperatureEffect =
    weather.temperatureF === undefined ? 0 : clamp((weather.temperatureF - 70) * 0.015, -0.35, 0.45);
  const windEffect = estimateWindRunImpact(weather, venueAzimuthAngle);
  return roundTo(temperatureEffect + windEffect, 2);
}

function estimateWindRunImpact(weather: GameWeather, venueAzimuthAngle: number | undefined): number {
  if (
    weather.windSpeedMph === undefined ||
    !weather.windDirection ||
    venueAzimuthAngle === undefined
  ) {
    return 0;
  }

  const fromDegrees = compassToDegrees(weather.windDirection);
  if (fromDegrees === undefined) {
    return 0;
  }

  const blowingTowardDegrees = normalizeDegrees(fromDegrees + 180);
  const outfieldDelta = angularDistance(blowingTowardDegrees, venueAzimuthAngle);
  if (outfieldDelta <= 45) {
    return clamp(weather.windSpeedMph * 0.025, 0, 0.35);
  }

  if (outfieldDelta >= 135) {
    return clamp(weather.windSpeedMph * -0.02, -0.3, 0);
  }

  return 0;
}

function compassToDegrees(direction: string): number | undefined {
  const directions = new Map([
    ["N", 0],
    ["NE", 45],
    ["E", 90],
    ["SE", 135],
    ["S", 180],
    ["SW", 225],
    ["W", 270],
    ["NW", 315],
  ]);
  return directions.get(direction.toUpperCase());
}

function angularDistance(left: number, right: number): number {
  const distance = Math.abs(normalizeDegrees(left) - normalizeDegrees(right));
  return Math.min(distance, 360 - distance);
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function addMissingSignalCounts(
  left: Partial<Record<HistoricalFeatureMissingSignal, number>>,
  right: Partial<Record<HistoricalFeatureMissingSignal, number>>
): Partial<Record<HistoricalFeatureMissingSignal, number>> {
  const merged: Partial<Record<HistoricalFeatureMissingSignal, number>> = { ...left };
  for (const [signal, count] of Object.entries(right) as Array<[HistoricalFeatureMissingSignal, number]>) {
    merged[signal] = (merged[signal] ?? 0) + count;
  }
  return merged;
}

function normalizeCachedOddsEvent(event: any): OddsEvent {
  return {
    id: event.id ?? "",
    commenceTime: event.commenceTime ?? event.commence_time ?? "",
    homeTeam: event.homeTeam ?? event.home_team ?? "",
    awayTeam: event.awayTeam ?? event.away_team ?? "",
    bookmakers: (event.bookmakers ?? []).map(normalizeCachedBookmaker),
  };
}

function normalizeCachedBookmaker(bookmaker: any): OddsBookmaker {
  return {
    key: bookmaker.key ?? "",
    title: bookmaker.title ?? "",
    lastUpdate: bookmaker.lastUpdate ?? bookmaker.last_update ?? "",
    markets: (bookmaker.markets ?? []).map((market: any) => ({
      key: market.key ?? "",
      outcomes: (market.outcomes ?? []).map((outcome: any) => ({
        name: outcome.name ?? "",
        price: outcome.price,
        point: outcome.point,
      })),
    })),
  };
}

function writeCachedOddsSnapshot(
  cacheDir: string,
  season: number,
  isoTimestamp: string,
  events: unknown[],
  markets: string[]
): void {
  const path = oddsCachePath(cacheDir, season, isoTimestamp);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        isoTimestamp,
        fetchedAt: new Date().toISOString(),
        source: "the-odds-api",
        markets,
        events,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function oddsCachePath(cacheDir: string, season: number, isoTimestamp: string): string {
  return join(cacheDir, String(season), `${isoTimestamp.replace(/[:.]/g, "-")}.json`);
}

function listOddsCacheFiles(cacheDir: string): string[] {
  if (!existsSync(cacheDir)) {
    return [];
  }

  return readdirSync(cacheDir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(cacheDir, entry.name);
    if (entry.isDirectory()) {
      return listOddsCacheFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
  });
}

function normalizeMarkets(markets: string[] | undefined): string[] {
  const requested = markets?.map((market) => market.trim()).filter(Boolean) ?? DEFAULT_ODDS_MARKETS;
  const allowed = new Set(DEFAULT_ODDS_MARKETS);
  const normalized = requested.filter((market) => allowed.has(market));
  return normalized.length > 0 ? [...new Set(normalized)] : DEFAULT_ODDS_MARKETS;
}

function isMoneylineOnlyRequest(markets: string[]): boolean {
  return markets.length === 1 && markets[0] === "h2h";
}

function determineSnapshotMarkets(
  events: Array<{ bookmakers: Array<{ markets: Array<{ key: string }> }> }>,
  requestedMarkets: string[]
): string[] {
  if (hasAllRequestedMarkets(events, requestedMarkets)) {
    return requestedMarkets;
  }

  return hasAllRequestedMarkets(events, ["h2h"]) ? ["h2h"] : [];
}

function isFullMarketSnapshot(markets: string[]): boolean {
  return DEFAULT_ODDS_MARKETS.every((market) => markets.includes(market));
}

function hasAllRequestedMarkets(events: Array<{ bookmakers: Array<{ markets: Array<{ key: string }> }> }>, markets: string[]): boolean {
  if (events.length === 0) {
    return false;
  }

  return events.some((event) =>
    event.bookmakers.some((bookmaker) => {
      const available = bookmaker.markets.map((market) => market.key);
      return markets.every((market) => available.includes(market));
    })
  );
}
