import { summarizeBacktest, type BacktestPick } from "./backtest.js";
import { buildCalibrationBuckets, recommendThresholdChanges } from "./calibration.js";
import { buildPickExplanation } from "./explanations.js";
import { gradeParlay, gradePick, type FinalGameResult } from "./grading.js";
import { buildHistoricalBacktestReadiness } from "./historicalBacktest.js";
import { buildDailyParlays } from "./parlays.js";
import { analyzeGame, selectQualifiedPicks, type GameAnalysis, type Pick } from "./picks.js";
import { type GameFeatures } from "./projection.js";

const previewSlate: GameFeatures[] = [
  {
    gameId: "atl-nym-20260701",
    date: "2026-07-01",
    homeTeam: "Atlanta Braves",
    awayTeam: "New York Mets",
    homeMoneyline: -125,
    awayMoneyline: 112,
    total: 8.5,
    overOdds: -108,
    underOdds: -112,
    runLine: -1.5,
    homeRunLineOdds: 145,
    awayRunLineOdds: -165,
    homeWrcPlus: 126,
    awayWrcPlus: 91,
    homeStarterFip: 3.14,
    awayStarterFip: 4.92,
    homeBullpenRest: 82,
    awayBullpenRest: 44,
    parkRunFactor: 103,
    weatherRunImpact: 0.2,
    homeLineupConfirmed: true,
    awayLineupConfirmed: false,
    homeRecentForm: 1.2,
    awayRecentForm: -0.4,
  },
  {
    gameId: "lad-col-20260701",
    date: "2026-07-01",
    homeTeam: "Los Angeles Dodgers",
    awayTeam: "Colorado Rockies",
    homeMoneyline: -180,
    awayMoneyline: 155,
    total: 8,
    overOdds: -112,
    underOdds: -108,
    runLine: -1.5,
    homeRunLineOdds: -105,
    awayRunLineOdds: -115,
    homeWrcPlus: 132,
    awayWrcPlus: 84,
    homeStarterFip: 2.94,
    awayStarterFip: 5.4,
    homeBullpenRest: 76,
    awayBullpenRest: 38,
    parkRunFactor: 98,
    weatherRunImpact: -0.1,
    homeLineupConfirmed: true,
    awayLineupConfirmed: true,
    homeRecentForm: 1.4,
    awayRecentForm: -1.2,
  },
  {
    gameId: "hou-tex-20260701",
    date: "2026-07-01",
    homeTeam: "Texas Rangers",
    awayTeam: "Houston Astros",
    homeMoneyline: 104,
    awayMoneyline: -118,
    total: 9,
    overOdds: -105,
    underOdds: -115,
    runLine: -1.5,
    homeRunLineOdds: 172,
    awayRunLineOdds: -192,
    homeWrcPlus: 108,
    awayWrcPlus: 119,
    homeStarterFip: 4.72,
    awayStarterFip: 3.32,
    homeBullpenRest: 48,
    awayBullpenRest: 77,
    parkRunFactor: 109,
    weatherRunImpact: 0.55,
    homeLineupConfirmed: false,
    awayLineupConfirmed: true,
    homeRecentForm: -0.2,
    awayRecentForm: 0.7,
  },
  {
    gameId: "sea-min-20260701",
    date: "2026-07-01",
    homeTeam: "Minnesota Twins",
    awayTeam: "Seattle Mariners",
    homeMoneyline: -102,
    awayMoneyline: -108,
    total: 7.5,
    overOdds: -118,
    underOdds: 102,
    runLine: -1.5,
    homeRunLineOdds: 160,
    awayRunLineOdds: -182,
    homeWrcPlus: 93,
    awayWrcPlus: 114,
    homeStarterFip: 4.48,
    awayStarterFip: 3.08,
    homeBullpenRest: 51,
    awayBullpenRest: 80,
    parkRunFactor: 96,
    weatherRunImpact: -0.25,
    homeLineupConfirmed: true,
    awayLineupConfirmed: true,
    homeRecentForm: -0.5,
    awayRecentForm: 0.9,
  },
  {
    gameId: "bos-tb-20260701",
    date: "2026-07-01",
    homeTeam: "Tampa Bay Rays",
    awayTeam: "Boston Red Sox",
    homeMoneyline: -112,
    awayMoneyline: 102,
    total: 8,
    overOdds: 104,
    underOdds: -120,
    runLine: -1.5,
    homeRunLineOdds: 168,
    awayRunLineOdds: -190,
    homeWrcPlus: 118,
    awayWrcPlus: 97,
    homeStarterFip: 3.36,
    awayStarterFip: 4.64,
    homeBullpenRest: 74,
    awayBullpenRest: 45,
    parkRunFactor: 94,
    weatherRunImpact: 0,
    homeLineupConfirmed: false,
    awayLineupConfirmed: false,
    homeRecentForm: 0.8,
    awayRecentForm: -0.6,
  },
  {
    gameId: "phi-mia-20260701",
    date: "2026-07-01",
    homeTeam: "Miami Marlins",
    awayTeam: "Philadelphia Phillies",
    homeMoneyline: 136,
    awayMoneyline: -150,
    total: 7.5,
    overOdds: -102,
    underOdds: -118,
    runLine: -1.5,
    homeRunLineOdds: 210,
    awayRunLineOdds: -245,
    homeWrcPlus: 86,
    awayWrcPlus: 123,
    homeStarterFip: 4.88,
    awayStarterFip: 3.22,
    homeBullpenRest: 41,
    awayBullpenRest: 79,
    parkRunFactor: 92,
    weatherRunImpact: -0.1,
    homeLineupConfirmed: true,
    awayLineupConfirmed: true,
    homeRecentForm: -0.9,
    awayRecentForm: 1.1,
  },
];

const analyses = previewSlate.map((game) => analyzeGame(game));
const picks = selectQualifiedPicks(analyses).slice(0, 12);
const parlays = buildDailyParlays(picks);
const finalResults: FinalGameResult[] = [
  resultFor("atl-nym-20260701", "Atlanta Braves", "New York Mets", 6, 3),
  resultFor("lad-col-20260701", "Los Angeles Dodgers", "Colorado Rockies", 5, 2),
  resultFor("hou-tex-20260701", "Texas Rangers", "Houston Astros", 4, 6),
  resultFor("sea-min-20260701", "Minnesota Twins", "Seattle Mariners", 2, 4),
  resultFor("bos-tb-20260701", "Tampa Bay Rays", "Boston Red Sox", 4, 3),
  resultFor("phi-mia-20260701", "Miami Marlins", "Philadelphia Phillies", 1, 5),
];
const gradedPicks = picks.map((pick) => gradePick(pick, finalResults.find((result) => result.gameId === pick.gameId)!));
const gradedParlays = parlays.map((parlay) => gradeParlay(parlay, finalResults));
const backtestPicks = buildBacktestPicks(picks);
const historicalBacktest = buildHistoricalBacktestReadiness({
  asOfDateIso: "2026-07-01",
  oddsApiConfigured: true,
});

export const sampleModelPreview = {
  date: "2026-07-01",
  analyses,
  picks,
  explanations: Object.fromEntries(picks.map((pick) => [pick.id, buildPickExplanation(pick)])),
  parlays,
  gradedPicks,
  gradedParlays,
  backtestSummary: summarizeBacktest(backtestPicks),
  historicalBacktest,
  calibrationBuckets: buildCalibrationBuckets(backtestPicks),
  thresholdRecommendations: recommendThresholdChanges(backtestPicks),
  apiHealth: [
    { name: "MLB Stats API", status: "Available", detail: "Schedules and final scores" },
    { name: "The Odds API", status: "Configured", detail: "Current odds and historical lines" },
    { name: "National Weather Service", status: "Ready", detail: "U.S. stadium hourly forecast" },
    { name: "Open-Meteo", status: "Fallback", detail: "Non-U.S. or NWS outage weather" },
    { name: "OpenAI", status: "Optional", detail: "Narrative debriefs only" },
  ],
};

export type SampleModelPreview = typeof sampleModelPreview;

function resultFor(
  gameId: string,
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number
): FinalGameResult {
  return { gameId, status: "final", homeTeam, awayTeam, homeScore, awayScore };
}

function buildBacktestPicks(seedPicks: Pick[]): BacktestPick[] {
  return Array.from({ length: 220 }, (_, index) => {
    const seed = seedPicks[index % seedPicks.length]!;
    const pick = {
      ...seed,
      id: `${seed.id}:bt-${index}`,
      date: `2026-05-${String((index % 28) + 1).padStart(2, "0")}`,
      modelProbability: roundTo(seed.modelProbability - 0.04 + (index % 7) * 0.01, 4),
      edge: roundTo(seed.edge - 0.015 + (index % 5) * 0.006, 4),
    };
    const isLoss = index % 5 === 0 || (pick.edge < 0.035 && index % 3 === 0);

    return {
      pick,
      result: isLoss ? "loss" : "win",
      actualScore: isLoss ? "Opponent 5, Model side 3" : "Model side 5, Opponent 3",
      projectedTotal: seed.projection.projectedTotal,
      projectedMargin: seed.projection.projectedHomeRuns - seed.projection.projectedAwayRuns,
      modelVersion: seed.modelVersion,
      edge: pick.edge,
      notes: [],
      closingOdds: index % 4 === 0 ? seed.odds - 15 : undefined,
    };
  });
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
