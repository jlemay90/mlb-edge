import { type BacktestPick, type BacktestSlate } from "./backtest.js";
import { gradePick, type FinalGameResult } from "./grading.js";
import { type HistoricalSeasonCoverage, type HistoricalSeasonReplay, type RequiredHistoricalSignal } from "./historicalBacktest.js";
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from "./modelConfig.js";
import { analyzeGame, selectQualifiedPicks } from "./picks.js";
import { type GameFeatures } from "./projection.js";

export type HistoricalGameReplayInput = {
  date: string;
  gameId: string;
  featureSnapshot?: GameFeatures;
  finalResult?: FinalGameResult;
  oddsSnapshotAvailable?: boolean;
  weatherSnapshotAvailable?: boolean;
  parkFactorAvailable?: boolean;
  closingOddsByPickId?: Record<string, number>;
};

export type HistoricalSeasonReplayRequest = {
  season: number;
  games: HistoricalGameReplayInput[];
  modelConfig?: ModelConfig;
};

export function buildHistoricalSeasonReplay(request: HistoricalSeasonReplayRequest): HistoricalSeasonReplay {
  const modelConfig = request.modelConfig ?? DEFAULT_MODEL_CONFIG;
  const picks = request.games.flatMap((game) => buildBacktestPicksForGame(game, modelConfig));

  return {
    season: request.season,
    slates: groupPicksByDate(picks),
    coverage: buildCoverage(request.games),
  };
}

function buildBacktestPicksForGame(
  game: HistoricalGameReplayInput,
  modelConfig: ModelConfig
): BacktestPick[] {
  if (!game.featureSnapshot || !game.finalResult || !hasOddsInSnapshot(game.featureSnapshot)) {
    return [];
  }

  const analysis = analyzeGame(game.featureSnapshot, modelConfig);
  const qualified = selectQualifiedPicks([analysis], modelConfig);

  return qualified.map((pick) => {
    const graded = gradePick(pick, game.finalResult!);

    return {
      pick,
      result: graded.result,
      actualScore: graded.actualScore,
      projectedTotal: graded.projectedTotal,
      projectedMargin: graded.projectedMargin,
      modelVersion: graded.modelVersion,
      edge: graded.edge,
      notes: graded.notes,
      closingOdds: game.closingOddsByPickId?.[pick.id],
    };
  });
}

function groupPicksByDate(picks: BacktestPick[]): BacktestSlate[] {
  const byDate = new Map<string, BacktestPick[]>();

  picks.forEach((pick) => {
    const date = pick.pick.date;
    byDate.set(date, [...(byDate.get(date) ?? []), pick]);
  });

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, slatePicks]) => ({ date, picks: slatePicks }));
}

function buildCoverage(games: HistoricalGameReplayInput[]): HistoricalSeasonCoverage {
  const scheduledGames = games.length;
  const finalResults = games.filter((game) => game.finalResult !== undefined).length;
  const oddsSnapshots = games.filter((game) => game.oddsSnapshotAvailable ?? hasOddsInSnapshot(game.featureSnapshot)).length;
  const weatherSnapshots = games.filter((game) => game.weatherSnapshotAvailable ?? game.featureSnapshot?.weatherRunImpact !== undefined).length;
  const parkFactors = games.filter((game) => game.parkFactorAvailable ?? game.featureSnapshot?.parkRunFactor !== undefined).length;
  const featureSnapshots = games.filter((game) => hasCompleteFeatureSnapshot(game.featureSnapshot)).length;

  return {
    scheduledGames,
    finalResults,
    oddsSnapshots,
    weatherSnapshots,
    parkFactors,
    featureSnapshots,
    missingSignals: buildMissingSignals({
      scheduledGames,
      finalResults,
      oddsSnapshots,
      weatherSnapshots,
      parkFactors,
      featureSnapshots,
    }),
    blockers: buildBlockers({
      scheduledGames,
      finalResults,
      oddsSnapshots,
      weatherSnapshots,
      parkFactors,
      featureSnapshots,
    }),
  };
}

function buildMissingSignals(counts: {
  scheduledGames: number;
  finalResults: number;
  oddsSnapshots: number;
  weatherSnapshots: number;
  parkFactors: number;
  featureSnapshots: number;
}): RequiredHistoricalSignal[] {
  if (counts.scheduledGames === 0) {
    return ["historical odds", "final results", "weather", "park factors", "feature snapshots"];
  }

  const signals: RequiredHistoricalSignal[] = [];

  if (counts.oddsSnapshots < counts.scheduledGames) signals.push("historical odds");
  if (counts.finalResults < counts.scheduledGames) signals.push("final results");
  if (counts.weatherSnapshots < counts.scheduledGames) signals.push("weather");
  if (counts.parkFactors < counts.scheduledGames) signals.push("park factors");
  if (counts.featureSnapshots < counts.scheduledGames) signals.push("feature snapshots");

  return signals;
}

function buildBlockers(counts: {
  scheduledGames: number;
  finalResults: number;
  oddsSnapshots: number;
  weatherSnapshots: number;
  parkFactors: number;
  featureSnapshots: number;
}): string[] {
  if (counts.scheduledGames === 0) {
    return ["No cached replay rows found for this season."];
  }

  return [
    missingCountMessage(counts.scheduledGames - counts.oddsSnapshots, "historical odds snapshots"),
    missingCountMessage(counts.scheduledGames - counts.finalResults, "final results"),
    missingCountMessage(counts.scheduledGames - counts.weatherSnapshots, "weather snapshots"),
    missingCountMessage(counts.scheduledGames - counts.parkFactors, "park factors"),
    missingCountMessage(counts.scheduledGames - counts.featureSnapshots, "imported feature snapshots"),
  ].filter((message): message is string => message !== undefined);
}

function missingCountMessage(count: number, label: string): string | undefined {
  if (count <= 0) {
    return undefined;
  }

  return `${count} ${count === 1 ? "game is" : "games are"} missing ${label}.`;
}

function hasOddsInSnapshot(features: GameFeatures | undefined): boolean {
  return (
    features?.homeMoneyline !== undefined ||
    features?.awayMoneyline !== undefined ||
    features?.overOdds !== undefined ||
    features?.underOdds !== undefined ||
    features?.homeRunLineOdds !== undefined ||
    features?.awayRunLineOdds !== undefined
  );
}

function hasCompleteFeatureSnapshot(features: GameFeatures | undefined): features is GameFeatures {
  if (!features) {
    return false;
  }

  const requiredTextFields = [features.gameId, features.date, features.homeTeam, features.awayTeam];
  const requiredNumberFields = [
    features.homeMoneyline,
    features.awayMoneyline,
    features.total,
    features.overOdds,
    features.underOdds,
    features.runLine,
    features.homeRunLineOdds,
    features.awayRunLineOdds,
    features.homeWrcPlus,
    features.awayWrcPlus,
    features.homeStarterFip,
    features.awayStarterFip,
    features.homeBullpenRest,
    features.awayBullpenRest,
    features.parkRunFactor,
    features.weatherRunImpact,
    features.homeRecentForm,
    features.awayRecentForm,
  ];

  return (
    requiredTextFields.every((value) => value.trim().length > 0) &&
    requiredNumberFields.every((value) => typeof value === "number" && Number.isFinite(value)) &&
    typeof features.homeLineupConfirmed === "boolean" &&
    typeof features.awayLineupConfirmed === "boolean"
  );
}
