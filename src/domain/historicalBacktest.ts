import { runBacktest, type BacktestSlate, type BacktestSummary } from "./backtest";

export type RequiredHistoricalSignal =
  | "historical odds"
  | "final results"
  | "weather"
  | "park factors"
  | "feature snapshots";

export type HistoricalSeasonCoverage = {
  scheduledGames: number;
  finalResults: number;
  oddsSnapshots: number;
  weatherSnapshots: number;
  parkFactors: number;
  featureSnapshots: number;
  missingSignals: RequiredHistoricalSignal[];
  blockers: string[];
};

export type HistoricalSeasonReplay = {
  season: number;
  slates: BacktestSlate[];
  coverage: HistoricalSeasonCoverage;
};

export type HistoricalCoverageReport = HistoricalSeasonCoverage & {
  season: number;
  complete: boolean;
};

export type HistoricalBacktestStatus = "verified" | "partial" | "blocked";

export type HistoricalBacktestReport = {
  seasons: number[];
  requiredSeasonCount: number;
  completedSeasonCount: number;
  status: HistoricalBacktestStatus;
  summary: BacktestSummary;
  coverage: HistoricalCoverageReport[];
  blockers: string[];
  canClaimHighSuccessRate: boolean;
};

export type HistoricalBacktestRequest = {
  seasons: number[];
  loadSeason: (season: number) => Promise<HistoricalSeasonReplay>;
  requiredSeasonCount?: number;
  minimumWinRateForHighSuccess?: number;
};

const DEFAULT_REQUIRED_SEASONS = 5;
const DEFAULT_HIGH_SUCCESS_WIN_RATE = 0.55;

export function getDefaultCompletedSeasons(asOfDateIso: string, count = DEFAULT_REQUIRED_SEASONS): number[] {
  const asOf = new Date(`${asOfDateIso}T00:00:00Z`);
  if (Number.isNaN(asOf.getTime())) {
    throw new Error("asOfDateIso must be a valid YYYY-MM-DD date");
  }

  const currentYear = asOf.getUTCFullYear();
  const currentSeasonIsComplete = asOf.getUTCMonth() >= 10;
  const endSeason = currentSeasonIsComplete ? currentYear : currentYear - 1;
  const startSeason = endSeason - count + 1;

  return Array.from({ length: count }, (_, index) => startSeason + index);
}

export async function runHistoricalBacktest(
  request: HistoricalBacktestRequest
): Promise<HistoricalBacktestReport> {
  const requiredSeasonCount = request.requiredSeasonCount ?? DEFAULT_REQUIRED_SEASONS;
  const minimumWinRate = request.minimumWinRateForHighSuccess ?? DEFAULT_HIGH_SUCCESS_WIN_RATE;
  const replays = await Promise.all(request.seasons.map((season) => request.loadSeason(season)));
  const coverage = replays.map((replay) => ({
    season: replay.season,
    ...replay.coverage,
    complete: isCoverageComplete(replay.coverage),
  }));
  const completedSeasonCount = coverage.filter((season) => season.complete).length;
  const coverageBlockers = coverage.flatMap((season) =>
    season.blockers.map((blocker) => `${season.season}: ${blocker}`)
  );
  const seasonCountBlocker =
    completedSeasonCount < requiredSeasonCount
      ? [`Need ${requiredSeasonCount} completed seasons with odds, results, weather, park factors, and feature snapshots; currently have ${completedSeasonCount}.`]
      : [];
  const missingSignalBlockers = coverage.flatMap((season) =>
    season.missingSignals.map((signal) => `${season.season}: missing ${signal}`)
  );
  const blockers = [...coverageBlockers, ...missingSignalBlockers, ...seasonCountBlocker];
  const summary = runBacktest(replays.flatMap((replay) => replay.slates));
  const status = determineStatus(completedSeasonCount, requiredSeasonCount, coverageBlockers);

  return {
    seasons: [...request.seasons],
    requiredSeasonCount,
    completedSeasonCount,
    status,
    summary,
    coverage,
    blockers,
    canClaimHighSuccessRate:
      status === "verified" && summary.roi > 0 && summary.winRate >= minimumWinRate,
  };
}

function determineStatus(
  completedSeasonCount: number,
  requiredSeasonCount: number,
  coverageBlockers: string[]
): HistoricalBacktestStatus {
  if (coverageBlockers.length > 0) {
    return "blocked";
  }

  if (completedSeasonCount < requiredSeasonCount) {
    return "partial";
  }

  return "verified";
}

function isCoverageComplete(coverage: HistoricalSeasonCoverage): boolean {
  return (
    coverage.scheduledGames > 0 &&
    coverage.finalResults > 0 &&
    coverage.oddsSnapshots > 0 &&
    coverage.weatherSnapshots > 0 &&
    coverage.parkFactors > 0 &&
    coverage.featureSnapshots > 0 &&
    coverage.missingSignals.length === 0 &&
    coverage.blockers.length === 0
  );
}
