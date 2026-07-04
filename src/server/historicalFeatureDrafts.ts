import { applyKnownBallparkContext } from "../domain/ballparks.js";
import { type GameFeatures } from "../domain/projection.js";
import { type MlbScheduledGame } from "./providers/mlbStats.js";
import { type OddsEvent } from "./providers/oddsApi.js";

export type HistoricalFeatureMissingSignal =
  | "team offense"
  | "starter pitching"
  | "bullpen rest"
  | "park factors"
  | "weather"
  | "confirmed lineups"
  | "recent form";

export type HistoricalFeatureDraft = {
  featureSnapshot: GameFeatures;
  source: {
    oddsEventId: string;
    oddsSnapshotTime: string;
    oddsMarkets: string[];
  };
  missingSignals: HistoricalFeatureMissingSignal[];
};

export type HistoricalFeatureDraftRequest = {
  game: MlbScheduledGame;
  oddsEvents: OddsEvent[];
  oddsSnapshotTime: string;
  weatherRunImpact?: number;
  pregameContext?: Partial<GameFeatures>;
};

export function buildHistoricalFeatureDraft(
  request: HistoricalFeatureDraftRequest
): HistoricalFeatureDraft | undefined {
  const event = request.oddsEvents.find((candidate) => matchesGame(candidate, request.game));
  if (!event) {
    return undefined;
  }

  const featureSnapshot = applyKnownBallparkContext({
    gameId: request.game.gameId,
    date: request.game.officialDate ?? request.game.gameDate.slice(0, 10),
    homeTeam: request.game.homeTeam,
    awayTeam: request.game.awayTeam,
    venueName: request.game.venue,
    venueId: request.game.venueId,
    ...extractConsensusOdds(event),
    ...request.pregameContext,
    weatherRunImpact: request.weatherRunImpact ?? request.pregameContext?.weatherRunImpact,
  });

  return {
    featureSnapshot,
    source: {
      oddsEventId: event.id,
      oddsSnapshotTime: request.oddsSnapshotTime,
      oddsMarkets: uniqueMarkets(event),
    },
    missingSignals: missingSignals(featureSnapshot),
  };
}

function extractConsensusOdds(event: OddsEvent): Partial<GameFeatures> {
  return {
    ...extractMoneyline(event),
    ...extractRunLine(event),
    ...extractTotal(event),
  };
}

function extractMoneyline(event: OddsEvent): Partial<GameFeatures> {
  const homePrices = pricesForOutcome(event, "h2h", event.homeTeam);
  const awayPrices = pricesForOutcome(event, "h2h", event.awayTeam);

  return {
    homeMoneyline: median(homePrices),
    awayMoneyline: median(awayPrices),
  };
}

function extractRunLine(event: OddsEvent): Partial<GameFeatures> {
  const homeOutcomes = outcomesFor(event, "spreads", event.homeTeam);
  const awayOutcomes = outcomesFor(event, "spreads", event.awayTeam);

  return {
    runLine: median(homeOutcomes.map((outcome) => outcome.point).filter(isNumber)),
    homeRunLineOdds: median(homeOutcomes.map((outcome) => outcome.price).filter(isNumber)),
    awayRunLineOdds: median(awayOutcomes.map((outcome) => outcome.price).filter(isNumber)),
  };
}

function extractTotal(event: OddsEvent): Partial<GameFeatures> {
  const overOutcomes = outcomesFor(event, "totals", "Over");
  const underOutcomes = outcomesFor(event, "totals", "Under");

  return {
    total: median(overOutcomes.map((outcome) => outcome.point).filter(isNumber)),
    overOdds: median(overOutcomes.map((outcome) => outcome.price).filter(isNumber)),
    underOdds: median(underOutcomes.map((outcome) => outcome.price).filter(isNumber)),
  };
}

function pricesForOutcome(event: OddsEvent, marketKey: string, outcomeName: string): number[] {
  return outcomesFor(event, marketKey, outcomeName)
    .map((outcome) => outcome.price)
    .filter(isNumber);
}

function outcomesFor(event: OddsEvent, marketKey: string, outcomeName: string): Array<{ price: number; point?: number }> {
  return event.bookmakers.flatMap((bookmaker) =>
    bookmaker.markets
      .filter((market) => market.key === marketKey)
      .flatMap((market) =>
        market.outcomes.filter((outcome) => sameName(outcome.name, outcomeName))
      )
  );
}

function uniqueMarkets(event: OddsEvent): string[] {
  return [...new Set(event.bookmakers.flatMap((bookmaker) => bookmaker.markets.map((market) => market.key)))].sort();
}

function matchesGame(event: OddsEvent, game: MlbScheduledGame): boolean {
  return sameName(event.homeTeam, game.homeTeam) && sameName(event.awayTeam, game.awayTeam);
}

function missingSignals(features: GameFeatures): HistoricalFeatureMissingSignal[] {
  return [
    features.homeWrcPlus === undefined || features.awayWrcPlus === undefined ? "team offense" : undefined,
    features.homeStarterFip === undefined || features.awayStarterFip === undefined ? "starter pitching" : undefined,
    features.homeBullpenRest === undefined || features.awayBullpenRest === undefined ? "bullpen rest" : undefined,
    features.parkRunFactor === undefined ? "park factors" : undefined,
    features.weatherRunImpact === undefined ? "weather" : undefined,
    features.homeLineupConfirmed === undefined || features.awayLineupConfirmed === undefined
      ? "confirmed lineups"
      : undefined,
    features.homeRecentForm === undefined || features.awayRecentForm === undefined ? "recent form" : undefined,
  ].filter((signal): signal is HistoricalFeatureMissingSignal => signal !== undefined);
}

function median(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[midpoint]!;
  }

  return Math.round((sorted[midpoint - 1]! + sorted[midpoint]!) / 2);
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

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
