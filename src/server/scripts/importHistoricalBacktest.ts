import { resolve } from "node:path";
import { loadLocalEnv } from "../env.js";
import {
  buildHistoricalImportReport,
  buildOddsCacheManifest,
  writeHistoricalImportReport,
  writeOddsCacheManifest,
} from "../historicalImport.js";

loadLocalEnv();

const args = parseArgs(process.argv.slice(2));
const seasons = args.seasons?.split(",").map((season) => Number(season.trim()));
const maxOddsSnapshots = args.maxOdds === undefined ? 0 : Number(args.maxOdds);
const maxOddsApiCredits = args.maxApiCredits === undefined ? undefined : Number(args.maxApiCredits);
const maxWeatherSnapshots = parseWeatherLimit(args.maxWeather);
const maxPitcherLogRequests = parseUnlimitedLimit(args.maxPitcherLogs);
const markets = args.markets?.split(",").map((market) => market.trim());
const outPath = resolve(process.cwd(), args.out ?? "data/historical/import-report.json");
const cacheDir = args.cacheDir ?? "data/historical/odds-cache";
const weatherCacheDir = args.weatherCacheDir ?? "data/historical/weather-cache";
const pitcherLogCacheDir = args.pitcherLogCacheDir ?? "data/historical/pitcher-cache";
const apiCallLedgerPath = resolve(process.cwd(), args.ledgerPath ?? "data/historical/api-calls.jsonl");
const oddsCacheManifestPath = resolve(
  process.cwd(),
  args.manifestPath ?? "data/historical/odds-cache-manifest.json"
);

const report = await buildHistoricalImportReport({
  seasons: seasons?.filter((season) => Number.isInteger(season)),
  oddsApiKey: process.env.ODDS_API_KEY,
  maxOddsSnapshots: Number.isFinite(maxOddsSnapshots) ? maxOddsSnapshots : 0,
  maxOddsApiCredits: Number.isFinite(maxOddsApiCredits) ? maxOddsApiCredits : undefined,
  maxWeatherSnapshots,
  maxPitcherLogRequests,
  markets,
  cacheDir,
  weatherCacheDir,
  pitcherLogCacheDir,
  apiCallLedgerPath,
});

writeHistoricalImportReport(report, outPath);
const manifest = buildOddsCacheManifest(cacheDir);
writeOddsCacheManifest(manifest, oddsCacheManifestPath);

console.log(
  JSON.stringify(
    {
      reportPath: outPath,
      seasons: report.seasons,
      oddsApiConfigured: report.oddsApiConfigured,
      requestedMarkets: report.requestedMarkets,
      maxOddsSnapshots: report.maxOddsSnapshots,
      maxOddsApiCredits: report.maxOddsApiCredits,
      apiCallLedgerPath: report.apiCallLedgerPath,
      oddsCacheManifestPath,
      maxWeatherSnapshots: report.maxWeatherSnapshots,
      maxPitcherLogRequests: report.maxPitcherLogRequests,
      totals: report.totals,
      oddsCacheManifestTotals: manifest.totals,
      blockers: report.blockers.slice(0, 12),
    },
    null,
    2
  )
);

function parseArgs(argv: string[]): {
  seasons?: string;
  maxOdds?: string;
  maxApiCredits?: string;
  maxWeather?: string;
  maxPitcherLogs?: string;
  markets?: string;
  out?: string;
  cacheDir?: string;
  weatherCacheDir?: string;
  pitcherLogCacheDir?: string;
  ledgerPath?: string;
  manifestPath?: string;
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

function parseWeatherLimit(value: string | undefined): number | null {
  return parseUnlimitedLimit(value);
}

function parseUnlimitedLimit(value: string | undefined): number | null {
  if (value === undefined) {
    return 0;
  }

  if (["all", "unlimited"].includes(value.trim().toLowerCase())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
