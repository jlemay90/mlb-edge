import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildHistoricalFeatureDraft } from "../historicalFeatureDrafts.js";
import { buildHistoricalPregameContext, buildStarterPitchingContext } from "../historicalPregameFeatures.js";
import { fetchMlbScheduleRange, type MlbPitcherGameLogEntry, type MlbScheduledGame } from "../providers/mlbStats.js";
import { type OddsBookmaker, type OddsEvent } from "../providers/oddsApi.js";
import { type HistoricalImportReport, type OddsCacheManifest } from "../historicalImport.js";

type CachedOddsSnapshot = {
  isoTimestamp: string;
  markets?: string[];
  events?: unknown[];
};

type CachedWeather = {
  source?: string;
  observedAt?: string;
  temperatureF?: number;
  windSpeedMph?: number;
  windDirection?: string;
  weatherRunImpact?: number;
};

type ExportRow = Record<string, string | number | undefined>;

const args = parseArgs(process.argv.slice(2));
const importReportPath = resolve(process.cwd(), args.report ?? "data/historical/import-report.json");
const manifestPath = resolve(process.cwd(), args.manifest ?? "data/historical/odds-cache-manifest.json");
const weatherCacheDir = resolve(process.cwd(), args.weatherCacheDir ?? "data/historical/weather-cache");
const pitcherLogCacheDir = resolve(process.cwd(), args.pitcherLogCacheDir ?? "data/historical/pitcher-cache");
const outPath = resolve(process.cwd(), args.out ?? "data/historical/exports/called-games.csv");

const report = JSON.parse(readFileSync(importReportPath, "utf8")) as HistoricalImportReport;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as OddsCacheManifest;
const snapshotPaths = new Map(
  manifest.snapshots.map((snapshot) => [
    `${snapshot.season}:${snapshot.isoTimestamp}`,
    resolve(process.cwd(), snapshot.path),
  ])
);

const rows: ExportRow[] = [];
for (const season of report.seasons) {
  const schedule = await fetchMlbScheduleRange({
    startDate: `${season}-03-01`,
    endDate: `${season}-11-30`,
    gameTypes: "R",
  });
  if (!schedule.ok) {
    continue;
  }
  const pitcherLogsById = loadCachedPitcherLogsForSeason(pitcherLogCacheDir, season, schedule.data);

  for (const game of schedule.data) {
    if (!isResolvedForGrading(game) || !game.venue) {
      continue;
    }

    const oddsSnapshotTime = buildPregameSnapshotTime(game.gameDate);
    if (!oddsSnapshotTime) {
      continue;
    }

    const oddsCachePath = snapshotPaths.get(`${season}:${oddsSnapshotTime}`);
    if (!oddsCachePath || !existsSync(oddsCachePath)) {
      continue;
    }

    const oddsSnapshot = readCachedOddsSnapshot(oddsCachePath);
    const weatherCachePath = historicalWeatherCachePath(weatherCacheDir, season, game.gameId);
    const weather = readCachedWeather(weatherCachePath);
    const pregameContext = buildHistoricalPregameContext({
      game,
      games: schedule.data,
    });
    const starterContext = buildStarterPitchingContext({
      game,
      pitcherLogsById,
    });
    const draft = buildHistoricalFeatureDraft({
      game,
      oddsEvents: oddsSnapshot.events,
      oddsSnapshotTime,
      pregameContext: {
        ...pregameContext,
        ...starterContext,
      },
      weatherRunImpact: weather?.weatherRunImpact,
    });
    if (!draft) {
      continue;
    }

    rows.push({
      season,
      gameId: game.gameId,
      officialDate: game.officialDate ?? game.gameDate.slice(0, 10),
      gameDate: game.gameDate,
      status: game.status,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      awayScore: game.awayScore,
      homeScore: game.homeScore,
      venue: game.venue,
      oddsSnapshotTime,
      oddsEventId: draft.source.oddsEventId,
      oddsMarkets: draft.source.oddsMarkets.join("|"),
      oddsCachePath,
      oddsEventCount: oddsSnapshot.events.length,
      homeMoneyline: draft.featureSnapshot.homeMoneyline,
      awayMoneyline: draft.featureSnapshot.awayMoneyline,
      homeWrcPlus: draft.featureSnapshot.homeWrcPlus,
      awayWrcPlus: draft.featureSnapshot.awayWrcPlus,
      homeProbablePitcherId: game.homeProbablePitcherId,
      homeProbablePitcher: game.homeProbablePitcher,
      awayProbablePitcherId: game.awayProbablePitcherId,
      awayProbablePitcher: game.awayProbablePitcher,
      homeStarterFip: draft.featureSnapshot.homeStarterFip,
      awayStarterFip: draft.featureSnapshot.awayStarterFip,
      homeBullpenRest: draft.featureSnapshot.homeBullpenRest,
      awayBullpenRest: draft.featureSnapshot.awayBullpenRest,
      homeRecentForm: draft.featureSnapshot.homeRecentForm,
      awayRecentForm: draft.featureSnapshot.awayRecentForm,
      total: draft.featureSnapshot.total,
      overOdds: draft.featureSnapshot.overOdds,
      underOdds: draft.featureSnapshot.underOdds,
      runLine: draft.featureSnapshot.runLine,
      homeRunLineOdds: draft.featureSnapshot.homeRunLineOdds,
      awayRunLineOdds: draft.featureSnapshot.awayRunLineOdds,
      parkRunFactor: draft.featureSnapshot.parkRunFactor,
      parkFactorSource: draft.featureSnapshot.parkFactorSource,
      weatherCached: weather ? "yes" : "no",
      weatherCachePath: weather ? weatherCachePath : undefined,
      weatherSource: weather?.source,
      observedWeatherAt: weather?.observedAt,
      temperatureF: weather?.temperatureF,
      windSpeedMph: weather?.windSpeedMph,
      windDirection: weather?.windDirection,
      weatherRunImpact: weather?.weatherRunImpact,
      missingSignals: draft.missingSignals.join("|"),
    });
  }
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, toCsv(rows), "utf8");

const summaryPath = outPath.replace(/\.csv$/i, "-summary.json");
writeFileSync(
  summaryPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      csvPath: outPath,
      importReportPath,
      manifestPath,
      seasons: report.seasons,
      rows: rows.length,
      importTotals: report.totals,
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      csvPath: outPath,
      summaryPath,
      rows: rows.length,
      seasons: report.seasons,
    },
    null,
    2
  )
);

function readCachedOddsSnapshot(path: string): { isoTimestamp: string; events: OddsEvent[]; markets: string[] } {
  const cached = JSON.parse(readFileSync(path, "utf8")) as CachedOddsSnapshot;
  return {
    isoTimestamp: cached.isoTimestamp,
    events: (cached.events ?? []).map(normalizeCachedOddsEvent),
    markets: cached.markets ?? [],
  };
}

function readCachedWeather(path: string): CachedWeather | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8")) as CachedWeather;
  } catch {
    return undefined;
  }
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

function historicalWeatherCachePath(weatherCacheDir: string, season: number, gameId: string): string {
  return join(weatherCacheDir, String(season), `${gameId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
}

function loadCachedPitcherLogsForSeason(
  pitcherLogCacheDir: string,
  season: number,
  games: MlbScheduledGame[]
): Map<number, MlbPitcherGameLogEntry[]> {
  const logsById = new Map<number, MlbPitcherGameLogEntry[]>();
  const pitcherIds = [
    ...new Set(
      games.flatMap((game) => [game.homeProbablePitcherId, game.awayProbablePitcherId])
        .filter((value): value is number => value !== undefined)
    ),
  ];

  for (const pitcherId of pitcherIds) {
    const path = join(pitcherLogCacheDir, String(season), `${pitcherId}.json`);
    if (!existsSync(path)) {
      continue;
    }

    try {
      const cached = JSON.parse(readFileSync(path, "utf8")) as { logs?: MlbPitcherGameLogEntry[] };
      logsById.set(pitcherId, cached.logs ?? []);
    } catch {
      // Ignore malformed cache entries; the import report remains the coverage source of truth.
    }
  }

  return logsById;
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

function toCsv(rows: ExportRow[]): string {
  const headers = [
    "season",
    "gameId",
    "officialDate",
    "gameDate",
    "status",
    "awayTeam",
    "homeTeam",
    "awayScore",
    "homeScore",
    "venue",
    "oddsSnapshotTime",
    "oddsEventId",
    "oddsMarkets",
    "oddsCachePath",
    "oddsEventCount",
    "homeMoneyline",
    "awayMoneyline",
    "homeWrcPlus",
    "awayWrcPlus",
    "homeProbablePitcherId",
    "homeProbablePitcher",
    "awayProbablePitcherId",
    "awayProbablePitcher",
    "homeStarterFip",
    "awayStarterFip",
    "homeBullpenRest",
    "awayBullpenRest",
    "homeRecentForm",
    "awayRecentForm",
    "total",
    "overOdds",
    "underOdds",
    "runLine",
    "homeRunLineOdds",
    "awayRunLineOdds",
    "parkRunFactor",
    "parkFactorSource",
    "weatherCached",
    "weatherCachePath",
    "weatherSource",
    "observedWeatherAt",
    "temperatureF",
    "windSpeedMph",
    "windDirection",
    "weatherRunImpact",
    "missingSignals",
  ];

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseArgs(argv: string[]): {
  report?: string;
  manifest?: string;
  weatherCacheDir?: string;
  pitcherLogCacheDir?: string;
  out?: string;
} {
  return Object.fromEntries(
    argv
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => {
        const [key, ...valueParts] = arg.slice(2).split("=");
        return [toCamelCase(key), valueParts.join("=")];
      })
  );
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}
