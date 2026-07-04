import { type GameFeatures } from "./projection.js";

const ATHLETICS_SUTTER_START_YEAR = 2025;
const ATHLETICS_SUTTER_END_YEAR = 2027;
const SUTTER_HEALTH_PARK_VENUE_ID = "2529";
const SUTTER_HEALTH_PARK_NAME = "Sutter Health Park";
const BASEBALL_SAVANT_SOURCE = "Baseball Savant Statcast Park Factors index_runs";

const SUTTER_HEALTH_RUN_FACTORS_BY_YEAR = new Map([
  [2025, 117],
  [2026, 128],
]);

export function applyKnownBallparkContext(features: GameFeatures): GameFeatures {
  const seasonYear = getSeasonYear(features.date);
  const venueName = features.venueName?.trim();

  if (isSutterHealthPark(venueName)) {
    return withSutterHealthPark(features, seasonYear);
  }

  if (isAthletics(features.homeTeam) && isAthleticsSacramentoSeason(seasonYear)) {
    if (!venueName || isOaklandColiseum(venueName)) {
      return withSutterHealthPark(features, seasonYear);
    }
  }

  return { ...features };
}

export function getGameMatchup(features: Pick<GameFeatures, "awayTeam" | "homeTeam">): string {
  return `${features.awayTeam} at ${features.homeTeam}`;
}

function withSutterHealthPark(features: GameFeatures, seasonYear: number | undefined): GameFeatures {
  const factor = getSutterRunFactor(seasonYear);

  return {
    ...features,
    venueName: SUTTER_HEALTH_PARK_NAME,
    venueId: SUTTER_HEALTH_PARK_VENUE_ID,
    parkRunFactor: factor?.value ?? features.parkRunFactor,
    parkFactorSource: factor
      ? `${BASEBALL_SAVANT_SOURCE} ${factor.year} (venue ${SUTTER_HEALTH_PARK_VENUE_ID})`
      : features.parkFactorSource,
  };
}

function getSutterRunFactor(seasonYear: number | undefined): { year: number; value: number } | undefined {
  if (seasonYear === undefined) {
    return undefined;
  }

  const exact = SUTTER_HEALTH_RUN_FACTORS_BY_YEAR.get(seasonYear);
  if (exact !== undefined) {
    return { year: seasonYear, value: exact };
  }

  const latestKnownYear = [...SUTTER_HEALTH_RUN_FACTORS_BY_YEAR.keys()]
    .filter((year) => year <= seasonYear)
    .sort((a, b) => b - a)[0];

  if (latestKnownYear === undefined) {
    return undefined;
  }

  return { year: latestKnownYear, value: SUTTER_HEALTH_RUN_FACTORS_BY_YEAR.get(latestKnownYear)! };
}

function isAthleticsSacramentoSeason(seasonYear: number | undefined): boolean {
  return (
    seasonYear !== undefined &&
    seasonYear >= ATHLETICS_SUTTER_START_YEAR &&
    seasonYear <= ATHLETICS_SUTTER_END_YEAR
  );
}

function isAthletics(teamName: string): boolean {
  const normalized = normalizeName(teamName);
  return (
    normalized === "athletics" ||
    normalized === "oakland athletics" ||
    normalized === "sacramento athletics" ||
    normalized === "as" ||
    normalized === "a s" ||
    normalized === "oakland as" ||
    normalized === "oakland a s" ||
    normalized === "ath" ||
    normalized === "oak"
  );
}

function isOaklandColiseum(venueName: string | undefined): boolean {
  const normalized = normalizeName(venueName ?? "");
  return (
    normalized === "oakland coliseum" ||
    normalized === "oakland alameda county coliseum" ||
    normalized === "ringcentral coliseum"
  );
}

function isSutterHealthPark(venueName: string | undefined): boolean {
  return normalizeName(venueName ?? "") === "sutter health park";
}

function getSeasonYear(dateIso: string): number | undefined {
  const year = Number(dateIso.slice(0, 4));
  return Number.isFinite(year) ? year : undefined;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
