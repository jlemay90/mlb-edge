/**
 * MLB Edge — tRPC Router (v2 — fixed field mapping, full data passthrough)
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  mlbTeams,
  teamStats,
  pitcherStats,
  backtestResults,
  oddsSnapshots,
  parlayCards,
} from "../drizzle/schema";
import { eq, desc, and, inArray, asc, gte, sql } from "drizzle-orm";
import { cached, TTL } from "./services/cache";
import {
  fetchTodaysSchedule,
  fetchMLBOdds,
  fetchMLBEvents,
  fetchMLBPlayerProps,
  fetchAllTeams,
  STADIUM_DATA,
  TEAM_ABBR_MAP,
  UMPIRE_DATA,
  getUmpireTendency,
  fetchGameWeather,
  fetchBullpenStatus,
  fetchConfirmedLineups,
  fetchPitcherRecentForm,
  getParkFactorForHandedness,
} from "./services/mlbData";
import {
  analyzeGame,
  predictProp,
  GameFeatures,
} from "./services/predictionEngine";

// ─── Normalize a PredictionResult for frontend consumption ───────────────────
// The engine uses edgeScore/impliedProbability/modelProbability.
// We expose both the canonical names AND convenient aliases (edge, bookImplied)
// so the frontend never gets NaN from a missing field.

function normalizePick(pick: any, gamePk: number, homeTeam: string, awayTeam: string, homeAbbr: string, awayAbbr: string, gameTime: string, homePitcher?: string, awayPitcher?: string) {
  if (!pick) return null;
  const edge = typeof pick.edgeScore === "number" ? pick.edgeScore : 0;
  return {
    gamePk,
    gameTime,
    homeTeam,
    awayTeam,
    homeAbbr,
    awayAbbr,
    homePitcher,
    awayPitcher,
    market: pick.market,
    pick: pick.pick,
    pickLabel: pick.pickLabel,
    // Canonical names from engine
    modelProbability: pick.modelProbability,
    impliedProbability: pick.impliedProbability,
    edgeScore: edge,
    // Aliases expected by frontend audit
    edge,
    bookImplied: pick.impliedProbability,
    odds: pick.recommendedOdds,
    confidenceTier: pick.confidenceTier,
    recommendedOdds: pick.recommendedOdds,
    projectedHomeRuns: pick.projectedHomeRuns,
    projectedAwayRuns: pick.projectedAwayRuns,
    projectedTotal: pick.projectedTotal,
    features: pick.features || {},
    // Human-readable rationale
    rationale: buildRationale(pick),
  };
}

function buildRationale(pick: any): string {
  if (!pick) return "";
  const edge = ((pick.edgeScore || 0) * 100).toFixed(1);
  const modelPct = ((pick.modelProbability || 0) * 100).toFixed(1);
  const bookPct = ((pick.impliedProbability || 0) * 100).toFixed(1);
  const proj = pick.projectedTotal ? `Projected total: ${pick.projectedTotal.toFixed(1)} runs. ` : "";
  const diff = pick.projectedHomeRuns && pick.projectedAwayRuns
    ? `Model projects ${pick.projectedHomeRuns.toFixed(1)}-${pick.projectedAwayRuns.toFixed(1)}. `
    : "";
  return `${proj}${diff}Model win probability: ${modelPct}% vs book implied: ${bookPct}%. Edge: +${edge}%.`;
}

// ─── Build GameFeatures from pre-fetched data ─────────────────────────────────

export function buildGameFeaturesSync(
  game: any,
  oddsGame: any,
  homeTeamStatsRow: any,
  awayTeamStatsRow: any,
  homePitcherRow: any,
  awayPitcherRow: any,
  weather: any,
  // New model upgrade data (all optional for backward compat)
  homeBullpen?: any,
  awayBullpen?: any,
  lineupData?: any,
  homePitcherForm?: any,
  awayPitcherForm?: any
): GameFeatures {
  const homeTeamId = game.teams?.home?.team?.id;
  const awayTeamId = game.teams?.away?.team?.id;
  const homeTeamName = game.teams?.home?.team?.name || "Home";
  const awayTeamName = game.teams?.away?.team?.name || "Away";
  const stadiumInfo = STADIUM_DATA[homeTeamId] || null;

  // Umpire — get full tendency object
  const umpireName = game.officials?.find(
    (o: any) => o.officialType === "Home Plate"
  )?.official?.fullName;
  const umpireTendency = getUmpireTendency(umpireName || "default");

  // Parse odds — pull real spread odds from API spreads market
  let homeMoneyLine: number | undefined;
  let awayMoneyLine: number | undefined;
  let total: number | undefined;
  let overPrice: number | undefined;
  let underPrice: number | undefined;
  let homeRunLineOdds: number | undefined;
  let awayRunLineOdds: number | undefined;
  let runLine: number | undefined;

  if (oddsGame) {
    const bk = oddsGame.bookmakers?.[0];
    const h2hMarket = bk?.markets?.find((m: any) => m.key === "h2h");
    const totalsMarket = bk?.markets?.find((m: any) => m.key === "totals");
    const spreadsMarket = bk?.markets?.find((m: any) => m.key === "spreads");

    if (h2hMarket) {
      const homeOutcome = h2hMarket.outcomes?.find(
        (o: any) => o.name === homeTeamName || o.name?.includes(homeTeamName?.split(" ").pop())
      );
      const awayOutcome = h2hMarket.outcomes?.find(
        (o: any) => o.name === awayTeamName || o.name?.includes(awayTeamName?.split(" ").pop())
      );
      homeMoneyLine = homeOutcome?.price;
      awayMoneyLine = awayOutcome?.price;
    }

    if (totalsMarket) {
      const overOutcome = totalsMarket.outcomes?.find((o: any) => o.name === "Over");
      const underOutcome = totalsMarket.outcomes?.find((o: any) => o.name === "Under");
      total = overOutcome?.point || underOutcome?.point;
      overPrice = overOutcome?.price;
      underPrice = underOutcome?.price;
    }

    // Real run line odds from spreads market
    // runLine is ALWAYS the home team's spread point from the API.
    // In MLB, the favorite is always -1.5 and the underdog is always +1.5.
    // When the home team is the underdog (e.g. CHW at +4.5 vs ATL), homeSpread.point
    // will be positive — we must still record it as-is so the prediction engine
    // can correctly label who is favored.
    if (spreadsMarket) {
      const homeSpread = spreadsMarket.outcomes?.find(
        (o: any) => o.name === homeTeamName || o.name?.includes(homeTeamName?.split(" ").pop())
      );
      const awaySpread = spreadsMarket.outcomes?.find(
        (o: any) => o.name === awayTeamName || o.name?.includes(awayTeamName?.split(" ").pop())
      );
      if (homeSpread && awaySpread) {
        // Normalize: runLine is always the home team's actual spread point from the API.
        // If home team is the underdog (positive point), runLine will be positive.
        // The prediction engine uses this to determine who is favored.
        runLine = homeSpread.point;
        homeRunLineOdds = homeSpread.price;
        awayRunLineOdds = awaySpread.price;
      } else if (homeSpread) {
        runLine = homeSpread.point;
        homeRunLineOdds = homeSpread.price;
      } else if (awaySpread) {
        awayRunLineOdds = awaySpread.price;
      }
    }
  }

  return {
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    homePitcherName: game.teams?.home?.probablePitcher?.fullName,
    awayPitcherName: game.teams?.away?.probablePitcher?.fullName,
    // Pitchers from DB
    homePitcherFIP: homePitcherRow?.fip ?? undefined,
    awayPitcherFIP: awayPitcherRow?.fip ?? undefined,
    homePitcherXFIP: homePitcherRow?.xfip ?? undefined,
    awayPitcherXFIP: awayPitcherRow?.xfip ?? undefined,
    homePitcherKPct: homePitcherRow?.kPct ?? undefined,
    awayPitcherKPct: awayPitcherRow?.kPct ?? undefined,
    homePitcherBBPct: homePitcherRow?.bbPct ?? undefined,
    awayPitcherBBPct: awayPitcherRow?.bbPct ?? undefined,
    homePitcherLast3ERA: homePitcherRow?.last3GamesEra ?? undefined,
    awayPitcherLast3ERA: awayPitcherRow?.last3GamesEra ?? undefined,
    homePitcherDaysSinceStart: homePitcherRow?.daysSinceLastStart ?? undefined,
    awayPitcherDaysSinceStart: awayPitcherRow?.daysSinceLastStart ?? undefined,
    // Team offense from DB
    homeTeamWRCPlus: homeTeamStatsRow?.wrcPlus ?? undefined,
    awayTeamWRCPlus: awayTeamStatsRow?.wrcPlus ?? undefined,
    homeTeamOPS: homeTeamStatsRow?.ops ?? undefined,
    awayTeamOPS: awayTeamStatsRow?.ops ?? undefined,
    homeTeamRunsPerGame: homeTeamStatsRow?.runsPerGame ?? undefined,
    awayTeamRunsPerGame: awayTeamStatsRow?.runsPerGame ?? undefined,
    homeTeamKPct: homeTeamStatsRow?.kPct ?? undefined,
    awayTeamKPct: awayTeamStatsRow?.kPct ?? undefined,
    homeTeamBBPct: homeTeamStatsRow?.bbPct ?? undefined,
    awayTeamBBPct: awayTeamStatsRow?.bbPct ?? undefined,
    // Team defense from DB
    homeTeamERA: homeTeamStatsRow?.era ?? undefined,
    awayTeamERA: awayTeamStatsRow?.era ?? undefined,
    homeTeamFIP: homeTeamStatsRow?.fip ?? undefined,
    awayTeamFIP: awayTeamStatsRow?.fip ?? undefined,
    homeTeamXFIP: homeTeamStatsRow?.xfip ?? undefined,
    awayTeamXFIP: awayTeamStatsRow?.xfip ?? undefined,
    homeTeamWHIP: homeTeamStatsRow?.whip ?? undefined,
    awayTeamWHIP: awayTeamStatsRow?.whip ?? undefined,
    // Record
    homeTeamWinPct: homeTeamStatsRow?.winPct ?? undefined,
    awayTeamWinPct: awayTeamStatsRow?.winPct ?? undefined,
    homeTeamLastTenWins: homeTeamStatsRow?.lastTenW ?? undefined,
    awayTeamLastTenWins: awayTeamStatsRow?.lastTenW ?? undefined,
    homeTeamStreak: homeTeamStatsRow?.streak ?? undefined,
    awayTeamStreak: awayTeamStatsRow?.streak ?? undefined,
    // Splits
    homeTeamRunsPerGameHome: homeTeamStatsRow?.runsPerGameHome ?? undefined,
    awayTeamRunsPerGameAway: awayTeamStatsRow?.runsPerGameAway ?? undefined,
    homeTeamERAHome: homeTeamStatsRow?.eraHome ?? undefined,
    awayTeamERAAway: awayTeamStatsRow?.eraAway ?? undefined,
    // Park
    parkFactorRuns: stadiumInfo?.parkFactorRuns,
    parkFactorHR: stadiumInfo?.parkFactorHR,
    altitudeFt: stadiumInfo?.altFt,
    // Weather — full passthrough from fetchGameWeather return shape
    tempF: weather?.tempF,
    windSpeedMph: weather?.windSpeedMph,
    windDirLabel: weather?.windDirLabel,
    weatherRunImpact: weather?.runImpact,
    precipChance: weather?.precipChance,
    // Umpire
    umpireName,
    umpireKPctAboveAvg: umpireTendency.kPctAboveAvg,
    umpireBBPctAboveAvg: umpireTendency.bbPctAboveAvg,
    umpireAvgRunsPerGame: umpireTendency.avgRunsPerGame,
    umpireOverPct: umpireTendency.overPct,
    umpirePitcherFavorScore: umpireTendency.pitcherFavorScore,
    // Odds
    homeMoneyLine,
    awayMoneyLine,
    total,
    overPrice,
    underPrice,
    runLine,
    homeRunLineOdds,
    awayRunLineOdds,
    // Bullpen (model upgrade 3)
    homeBullpenRestScore: homeBullpen?.restScore,
    awayBullpenRestScore: awayBullpen?.restScore,
    homeBullpenFatiguedCount: homeBullpen?.fatiguedRelievers,
    awayBullpenFatiguedCount: awayBullpen?.fatiguedRelievers,
    // Confirmed lineup (model upgrade 1)
    homeLineupConfirmed: !!(lineupData?.home?.length),
    awayLineupConfirmed: !!(lineupData?.away?.length),
    homeLineupCount: lineupData?.home?.length,
    awayLineupCount: lineupData?.away?.length,
    // Pitcher recent form trend (model upgrade 2)
    homePitcherTrend: homePitcherForm?.trend,
    awayPitcherTrend: awayPitcherForm?.trend,
  };
}

// ─── Batch fetch all supporting data ─────────────────────────────────────────

async function fetchAllGameData(schedule: any[]) {
  const season = new Date().getFullYear();
  const db = await getDb();

  const teamIds = new Set<number>();
  const pitcherIds = new Set<number>();

  for (const game of schedule) {
    const homeId = game.teams?.home?.team?.id;
    const awayId = game.teams?.away?.team?.id;
    const homePitcherId = game.teams?.home?.probablePitcher?.id;
    const awayPitcherId = game.teams?.away?.probablePitcher?.id;
    if (homeId) teamIds.add(homeId);
    if (awayId) teamIds.add(awayId);
    if (homePitcherId) pitcherIds.add(homePitcherId);
    if (awayPitcherId) pitcherIds.add(awayPitcherId);
  }

  const [allTeamStats, allPitcherStats] = await Promise.all([
    db && teamIds.size > 0
      ? db.select().from(teamStats).where(and(inArray(teamStats.teamId, Array.from(teamIds)), eq(teamStats.season, season)))
      : Promise.resolve([]),
    db && pitcherIds.size > 0
      ? db.select().from(pitcherStats).where(and(inArray(pitcherStats.playerId, Array.from(pitcherIds)), eq(pitcherStats.season, season)))
      : Promise.resolve([]),
  ]);

  const teamStatsMap = new Map<number, any>();
  for (const row of (allTeamStats as any[])) teamStatsMap.set(row.teamId, row);

  const pitcherStatsMap = new Map<number, any>();
  for (const row of (allPitcherStats as any[])) pitcherStatsMap.set(row.playerId, row);

  // Collect unique team IDs and pitcher IDs for new fetches
  const allTeamIds = Array.from(teamIds);
  const allPitcherIds = Array.from(pitcherIds);

  // Fetch weather, bullpen status, confirmed lineups, and pitcher recent form in parallel
  const weatherMap = new Map<number, any>();
  const bullpenMap = new Map<number, any>(); // teamId -> BullpenStatus
  const lineupMap = new Map<number, any>();  // gamePk -> confirmed lineup
  const recentFormMap = new Map<number, any>(); // playerId -> PitcherRecentForm

  await Promise.all([
    // Weather
    ...schedule.map(async (game: any) => {
      const homeId = game.teams?.home?.team?.id;
      const stadiumInfo = STADIUM_DATA[homeId];
      if (stadiumInfo) {
        const w = await fetchGameWeather(
          game.gamePk, stadiumInfo.lat, stadiumInfo.lon,
          stadiumInfo.altFt, process.env.OPENWEATHER_API_KEY
        ).catch(() => null);
        if (w) weatherMap.set(game.gamePk, w);
      }
    }),
    // Bullpen status for all unique teams
    ...allTeamIds.map(async (teamId: number) => {
      const status = await fetchBullpenStatus(teamId).catch(() => null);
      if (status) bullpenMap.set(teamId, status);
    }),
    // Confirmed lineups for each game
    ...schedule.map(async (game: any) => {
      const lineup = await fetchConfirmedLineups(game.gamePk).catch(() => null);
      if (lineup) lineupMap.set(game.gamePk, lineup);
    }),
    // Pitcher recent form for all probable pitchers
    ...allPitcherIds.map(async (playerId: number) => {
      const pitcherRow = (allPitcherStats as any[]).find((p: any) => p.playerId === playerId);
      const name = pitcherRow?.fullName || "Unknown";
      const form = await fetchPitcherRecentForm(playerId, name).catch(() => null);
      if (form) recentFormMap.set(playerId, form);
    }),
  ]);

  return { teamStatsMap, pitcherStatsMap, weatherMap, bullpenMap, lineupMap, recentFormMap };
}

// ─── Match odds game by team name ─────────────────────────────────────────────

function matchOddsGame(game: any, oddsData: any[]): any {
  const homeTeamName = game.teams?.home?.team?.name || "";
  const awayTeamName = game.teams?.away?.team?.name || "";
  const homeLast = homeTeamName.split(" ").pop() || "";
  const awayLast = awayTeamName.split(" ").pop() || "";

  return oddsData.find((og: any) => {
    // Priority 1: exact full name match on home OR away
    if (og.home_team === homeTeamName && og.away_team === awayTeamName) return true;
    // Priority 2: exact full name match on either side (handles edge cases)
    if (og.home_team === homeTeamName || og.away_team === awayTeamName) return true;
    // Priority 3: last-word fuzzy match — MUST match BOTH teams to avoid
    // false positives like "White Sox" matching "Red Sox" games.
    const teams = og.bookmakers?.[0]?.markets?.[0]?.outcomes?.map((o: any) => o.name) || [];
    const homeMatch = teams.some((t: string) => t.includes(homeLast) || t === homeTeamName);
    const awayMatch = teams.some((t: string) => t.includes(awayLast) || t === awayTeamName);
    return homeMatch && awayMatch;
  });
}

// ─── MLB Router ───────────────────────────────────────────────────────────────

export const mlbRouter = router({
  // Get today's games with live odds, predictions, weather, umpire, park factors
  getTodaysGames: publicProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const date = input?.date || new Date().toISOString().split("T")[0];
      return cached(`todaysGames:${date}`, TTL.schedule, async () => {
      const [schedule, oddsData] = await Promise.all([
        fetchTodaysSchedule(date),
        fetchMLBOdds("h2h,spreads,totals").catch(() => []),
      ]);

      if (!schedule.length) return [];

      const { teamStatsMap, pitcherStatsMap, weatherMap, bullpenMap, lineupMap, recentFormMap } = await fetchAllGameData(schedule);

      const games = await Promise.all(
        schedule.map(async (game: any) => {
          const homeTeamId = game.teams?.home?.team?.id;
          const awayTeamId = game.teams?.away?.team?.id;
          const homeTeamName = game.teams?.home?.team?.name || "";
          const awayTeamName = game.teams?.away?.team?.name || "";
          const oddsGame = matchOddsGame(game, oddsData);
          const stadiumInfo = STADIUM_DATA[homeTeamId];
          const weather = weatherMap.get(game.gamePk);
          const homeBullpen = bullpenMap.get(homeTeamId);
          const awayBullpen = bullpenMap.get(awayTeamId);
          const lineupData = lineupMap.get(game.gamePk);
          const homePitcherForm = recentFormMap.get(game.teams?.home?.probablePitcher?.id);
          const awayPitcherForm = recentFormMap.get(game.teams?.away?.probablePitcher?.id);

          // Umpire full object
          const umpireName = game.officials?.find(
            (o: any) => o.officialType === "Home Plate"
          )?.official?.fullName;
          const umpireTendency = getUmpireTendency(umpireName || "default");

          const features = buildGameFeaturesSync(
            game, oddsGame,
            teamStatsMap.get(homeTeamId),
            teamStatsMap.get(awayTeamId),
            pitcherStatsMap.get(game.teams?.home?.probablePitcher?.id),
            pitcherStatsMap.get(game.teams?.away?.probablePitcher?.id),
            weather,
            homeBullpen,
            awayBullpen,
            lineupData,
            homePitcherForm,
            awayPitcherForm
          );
          const analysis = analyzeGame(features);

          const homeAbbr = TEAM_ABBR_MAP[homeTeamId] || "???";
          const awayAbbr = TEAM_ABBR_MAP[awayTeamId] || "???";
          const homePitcher = game.teams?.home?.probablePitcher?.fullName;
          const awayPitcher = game.teams?.away?.probablePitcher?.fullName;

          return {
            gamePk: game.gamePk,
            gameDate: date,
            gameTime: game.gameDate,
            status: game.status?.detailedState || "Scheduled",
            homeTeam: {
              id: homeTeamId,
              name: homeTeamName,
              abbreviation: homeAbbr,
              score: game.teams?.home?.score,
              record: game.teams?.home?.leagueRecord
                ? `${game.teams.home.leagueRecord.wins}-${game.teams.home.leagueRecord.losses}`
                : undefined,
            },
            awayTeam: {
              id: awayTeamId,
              name: awayTeamName,
              abbreviation: awayAbbr,
              score: game.teams?.away?.score,
              record: game.teams?.away?.leagueRecord
                ? `${game.teams.away.leagueRecord.wins}-${game.teams.away.leagueRecord.losses}`
                : undefined,
            },
            venue: game.venue?.name || stadiumInfo?.name,
            // Pitcher objects with stats
            homePitcher: {
              name: homePitcher || "TBD",
              era: pitcherStatsMap.get(game.teams?.home?.probablePitcher?.id)?.era,
              fip: pitcherStatsMap.get(game.teams?.home?.probablePitcher?.id)?.fip,
              xfip: pitcherStatsMap.get(game.teams?.home?.probablePitcher?.id)?.xfip,
              kPct: pitcherStatsMap.get(game.teams?.home?.probablePitcher?.id)?.kPct,
              bbPct: pitcherStatsMap.get(game.teams?.home?.probablePitcher?.id)?.bbPct,
              whip: pitcherStatsMap.get(game.teams?.home?.probablePitcher?.id)?.whip,
              last3Era: pitcherStatsMap.get(game.teams?.home?.probablePitcher?.id)?.last3GamesEra,
            },
            awayPitcher: {
              name: awayPitcher || "TBD",
              era: pitcherStatsMap.get(game.teams?.away?.probablePitcher?.id)?.era,
              fip: pitcherStatsMap.get(game.teams?.away?.probablePitcher?.id)?.fip,
              xfip: pitcherStatsMap.get(game.teams?.away?.probablePitcher?.id)?.xfip,
              kPct: pitcherStatsMap.get(game.teams?.away?.probablePitcher?.id)?.kPct,
              bbPct: pitcherStatsMap.get(game.teams?.away?.probablePitcher?.id)?.bbPct,
              whip: pitcherStatsMap.get(game.teams?.away?.probablePitcher?.id)?.whip,
              last3Era: pitcherStatsMap.get(game.teams?.away?.probablePitcher?.id)?.last3GamesEra,
            },
            // Full umpire object
            umpire: {
              name: umpireName || "TBD",
              strikeZoneSize: umpireTendency.strikeZoneSize,
              kPct: umpireTendency.kPctAboveAvg,
              bbPct: umpireTendency.bbPctAboveAvg,
              runsPerGame: umpireTendency.avgRunsPerGame,
              overPct: umpireTendency.overPct,
              pitcherFavorScore: umpireTendency.pitcherFavorScore,
              homeFavorScore: umpireTendency.homeFavorScore,
            },
            // Full weather object
            weather: weather
              ? {
                  temp: weather.tempF,
                  feelsLike: weather.feelsLikeF,
                  windSpeed: weather.windSpeedMph,
                  windDir: weather.windDirLabel,
                  humidity: weather.humidity,
                  conditions: weather.conditions,
                  precipChance: weather.precipChance,
                  runImpact: weather.runImpact,
                }
              : {
                  temp: 72,
                  feelsLike: 72,
                  windSpeed: 8,
                  windDir: "In from CF",
                  humidity: 55,
                  conditions: "Clear",
                  precipChance: 0,
                  runImpact: 0,
                },
            // Park factors
            parkFactor: {
              runs: stadiumInfo?.parkFactorRuns || 100,
              hr: stadiumInfo?.parkFactorHR || 100,
              hits: stadiumInfo?.parkFactorHits || 100,
              altitude: stadiumInfo?.altFt || 0,
              surface: stadiumInfo?.surface || "grass",
              name: stadiumInfo?.name || game.venue?.name,
            },
            // Odds with all markets
            odds: {
              homeMoneyLine: features.homeMoneyLine,
              awayMoneyLine: features.awayMoneyLine,
              total: features.total,
              overPrice: features.overPrice,
              underPrice: features.underPrice,
              homeRunLine: features.runLine,
              homeRunLineOdds: (features as any).homeRunLineOdds,
              awayRunLineOdds: (features as any).awayRunLineOdds,
            },
            // Model upgrade signals (new)
            modelSignals: {
              homeBullpen: homeBullpen ? {
                restScore: homeBullpen.restScore,
                fatiguedCount: homeBullpen.fatiguedRelievers,
                summary: homeBullpen.summary,
              } : null,
              awayBullpen: awayBullpen ? {
                restScore: awayBullpen.restScore,
                fatiguedCount: awayBullpen.fatiguedRelievers,
                summary: awayBullpen.summary,
              } : null,
              lineupConfirmed: {
                home: !!(lineupData?.home?.length),
                away: !!(lineupData?.away?.length),
              },
              pitcherTrend: {
                home: homePitcherForm?.trend || null,
                homeLast3ERA: homePitcherForm?.last3ERA || null,
                away: awayPitcherForm?.trend || null,
                awayLast3ERA: awayPitcherForm?.last3ERA || null,
              },
            },
            // Predictions with normalized picks
            predictions: {
              moneyLine: normalizePick(analysis.moneyLine, game.gamePk, homeTeamName, awayTeamName, homeAbbr, awayAbbr, game.gameDate, homePitcher, awayPitcher),
              runLine: normalizePick(analysis.runLine, game.gamePk, homeTeamName, awayTeamName, homeAbbr, awayAbbr, game.gameDate, homePitcher, awayPitcher),
              total: normalizePick(analysis.total, game.gamePk, homeTeamName, awayTeamName, homeAbbr, awayAbbr, game.gameDate, homePitcher, awayPitcher),
              topPick: normalizePick(analysis.topPick, game.gamePk, homeTeamName, awayTeamName, homeAbbr, awayAbbr, game.gameDate, homePitcher, awayPitcher),
              projectedHomeRuns: analysis.projectedHomeRuns,
              projectedAwayRuns: analysis.projectedAwayRuns,
              projectedTotal: analysis.projectedTotal,
            },
          };
        })
      );

      return games;
      });
    }),

  // Get top picks ranked by edge score
  getTopPicks: publicProcedure
    .input(
      z.object({
        date: z.string().optional(),
        market: z.enum(["all", "moneyline", "runline", "total"]).optional(),
        minTier: z.enum(["A", "B", "C", "D"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const date = input?.date || new Date().toISOString().split("T")[0];
      const cacheKey = `topPicks:${date}:${input?.market || "all"}:${input?.minTier || "D"}`;
      return cached(cacheKey, TTL.picks, async () => {
      const [schedule, oddsData] = await Promise.all([
        fetchTodaysSchedule(date),
        fetchMLBOdds("h2h,spreads,totals").catch(() => []),
      ]);

      if (!schedule.length) return [];

      const { teamStatsMap, pitcherStatsMap, weatherMap } = await fetchAllGameData(schedule);

      const allPicks: any[] = [];

      await Promise.all(
        schedule.map(async (game: any) => {
          const homeTeamId = game.teams?.home?.team?.id;
          const awayTeamId = game.teams?.away?.team?.id;
          const homeTeamName = game.teams?.home?.team?.name || "";
          const awayTeamName = game.teams?.away?.team?.name || "";
          const oddsGame = matchOddsGame(game, oddsData);
          const homeAbbr = TEAM_ABBR_MAP[homeTeamId] || "???";
          const awayAbbr = TEAM_ABBR_MAP[awayTeamId] || "???";
          const homePitcher = game.teams?.home?.probablePitcher?.fullName;
          const awayPitcher = game.teams?.away?.probablePitcher?.fullName;

          const features = buildGameFeaturesSync(
            game, oddsGame,
            teamStatsMap.get(homeTeamId),
            teamStatsMap.get(awayTeamId),
            pitcherStatsMap.get(game.teams?.home?.probablePitcher?.id),
            pitcherStatsMap.get(game.teams?.away?.probablePitcher?.id),
            weatherMap.get(game.gamePk)
          );
          const analysis = analyzeGame(features);

          const picks = [analysis.moneyLine, analysis.runLine, analysis.total].filter(Boolean);

          for (const pick of picks) {
            if (!pick) continue;
            if (input?.market && input.market !== "all" && pick.market !== input.market) continue;
            const tierOrder: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
            const minTier = input?.minTier || "D";
            if (tierOrder[pick.confidenceTier] > tierOrder[minTier]) continue;

            const normalized = normalizePick(pick, game.gamePk, homeTeamName, awayTeamName, homeAbbr, awayAbbr, game.gameDate, homePitcher, awayPitcher);
            if (normalized) allPicks.push(normalized);
          }
        })
      );

      return allPicks.sort((a, b) => (b.edgeScore || 0) - (a.edgeScore || 0));
      });
    }),

  // Get player props for today
  getPlayerProps: publicProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async () => {
      const events = await fetchMLBEvents().catch(() => []);
      const allProps: any[] = [];

      await Promise.all(
        events.slice(0, 5).map(async (event: any) => {
          const propsData = await fetchMLBPlayerProps(event.id).catch(() => null);
          if (!propsData) return;

          for (const bookmaker of propsData.bookmakers?.slice(0, 1) || []) {
            for (const market of bookmaker.markets || []) {
              for (const outcome of market.outcomes || []) {
                if (outcome.name !== "Over") continue;

                const overOutcome = market.outcomes.find(
                  (o: any) => o.name === "Over" && o.description === outcome.description
                );
                const underOutcome = market.outcomes.find(
                  (o: any) => o.name === "Under" && o.description === outcome.description
                );

                if (!overOutcome || !underOutcome) continue;

                const propResult = predictProp({
                  playerName: outcome.description || "Unknown",
                  propType: market.key,
                  line: outcome.point || 0,
                  overOdds: overOutcome.price || -110,
                  underOdds: underOutcome.price || -110,
                });

                if (propResult.pick === "pass") continue;

                const edgeScore = typeof propResult.edgeScore === "number" ? propResult.edgeScore : 0;

                allProps.push({
                  eventId: event.id,
                  homeTeam: event.home_team,
                  awayTeam: event.away_team,
                  playerName: outcome.description,
                  propType: market.key,
                  line: outcome.point,
                  overOdds: overOutcome.price,
                  underOdds: underOutcome.price,
                  // Canonical + aliases
                  pick: propResult.pick,
                  modelProjection: propResult.modelProjection,
                  edgeScore,
                  edge: edgeScore,
                  bookOdds: propResult.pick === "over" ? overOutcome.price : underOutcome.price,
                  confidenceTier: propResult.confidenceTier,
                  keyFactors: propResult.keyFactors,
                  rationale: propResult.keyFactors?.join(". ") || "",
                });
              }
            }
          }
        })
      );

      return allProps.sort((a, b) => (b.edgeScore || 0) - (a.edgeScore || 0));
    }),

  // Get team stats
  getTeamStats: publicProcedure
    .input(z.object({ season: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const season = input?.season || new Date().getFullYear();
      const db = await getDb();
      if (!db) return [];
      return db.select().from(teamStats).where(eq(teamStats.season, season)).orderBy(desc(teamStats.winPct));
    }),

  // Get backtest results
  getBacktestResults: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(backtestResults).orderBy(desc(backtestResults.roi));
  }),

  // Seed team data from MLB API
  seedTeams: publicProcedure.mutation(async () => {
    const teams = await fetchAllTeams();
    let seeded = 0;
    const db = await getDb();
    if (!db) return { seeded: 0 };

    for (const team of teams) {
      const stadiumInfo = STADIUM_DATA[team.id];
      await db
        .insert(mlbTeams)
        .values({
          teamId: team.id,
          name: team.name,
          abbreviation: team.abbreviation,
          shortName: team.shortName,
          division: team.division?.name,
          league: team.league?.name,
          venue: team.venue?.name,
          parkFactorRuns: stadiumInfo?.parkFactorRuns || 100,
          parkFactorHR: stadiumInfo?.parkFactorHR || 100,
          parkFactorHits: stadiumInfo?.parkFactorHits || 100,
          stadiumLat: stadiumInfo?.lat,
          stadiumLon: stadiumInfo?.lon,
          stadiumAltitudeFt: stadiumInfo?.altFt,
          surface: stadiumInfo?.surface || "grass",
        })
        .onDuplicateKeyUpdate({
          set: { name: team.name, abbreviation: team.abbreviation, venue: team.venue?.name },
        });
      seeded++;
    }

    return { seeded };
  }),

  // ─── Team Stats Explorer ─────────────────────────────────────────────────
  getTeamExplorer: publicProcedure
    .input(
      z.object({
        season: z.number().optional(),
        sortBy: z.enum(["winPct", "runsPerGame", "era", "fip", "wrcPlus", "ops", "whip"]).optional(),
        league: z.enum(["AL", "NL", "all"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const season = input?.season || new Date().getFullYear();
      const db = await getDb();
      if (!db) return { teams: [], rankings: {} };

      // Fetch live standings from MLB API to get real W/L records
      let standingsMap: Record<number, { wins: number; losses: number; winPct: number; streak: string; gb: string; division: string; divisionRank: number }> = {};
      try {
        const res = await fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team,division`);
        const data: any = await res.json();
        for (const record of data.records || []) {
          const division = record.division?.name || "";
          for (const tr of record.teamRecords || []) {
            const tid = tr.team?.id;
            if (!tid) continue;
            standingsMap[tid] = {
              wins: tr.wins || 0,
              losses: tr.losses || 0,
              winPct: parseFloat(tr.winningPercentage || "0"),
              streak: tr.streak?.streakCode || "",
              gb: tr.gamesBack || "—",
              division,
              divisionRank: tr.divisionRank || 0,
            };
          }
        }
      } catch (e) {
        console.warn("[TeamExplorer] Standings fetch failed", e);
      }

      // Fetch team stats from DB
      const stats = await db.select().from(teamStats).where(eq(teamStats.season, season));
      const teams = await db.select().from(mlbTeams);
      const teamsMap = Object.fromEntries(teams.map((t) => [t.teamId, t]));

      // Merge standings + stats + park factors
      const merged = stats.map((s) => {
        const team = teamsMap[s.teamId];
        const standing = standingsMap[s.teamId] || {};
        return {
          teamId: s.teamId,
          name: team?.name || `Team ${s.teamId}`,
          abbreviation: team?.abbreviation || "",
          division: standing.division || team?.division || "",
          league: team?.league || "",
          venue: team?.venue || "",
          // Record
          wins: standing.wins ?? s.wins ?? 0,
          losses: standing.losses ?? s.losses ?? 0,
          winPct: standing.winPct ?? s.winPct ?? 0,
          streak: standing.streak || (s.streak && s.streak > 0 ? `W${s.streak}` : s.streak && s.streak < 0 ? `L${Math.abs(s.streak)}` : "—"),
          gb: standing.gb || "—",
          divisionRank: standing.divisionRank || 0,
          lastTenW: s.lastTenW || 0,
          lastTenL: s.lastTenL || 0,
          // Offense
          runsPerGame: s.runsPerGame,
          wrcPlus: s.wrcPlus,
          ops: s.ops,
          obp: s.obp,
          slg: s.slg,
          avg: s.avg,
          iso: s.iso,
          babip: s.babip,
          kPct: s.kPct,
          bbPct: s.bbPct,
          hrPerGame: s.hrPerGame,
          // Splits
          runsPerGameHome: s.runsPerGameHome,
          runsPerGameAway: s.runsPerGameAway,
          runsPerGameVsL: s.runsPerGameVsL,
          runsPerGameVsR: s.runsPerGameVsR,
          // Pitching
          era: s.era,
          fip: s.fip,
          xfip: s.xfip,
          whip: s.whip,
          kPer9: s.kPer9,
          bbPer9: s.bbPer9,
          hrPer9: s.hrPer9,
          eraHome: s.eraHome,
          eraAway: s.eraAway,
          // Park
          parkFactorRuns: team?.parkFactorRuns,
          parkFactorHR: team?.parkFactorHR,
          altitudeFt: team?.stadiumAltitudeFt,
          surface: team?.surface,
        };
      });

      // Build league rankings for each key stat
      const rankStat = (arr: typeof merged, key: keyof typeof merged[0], ascending = false) => {
        const sorted = [...arr]
          .filter((t) => t[key] != null)
          .sort((a, b) => {
            const av = a[key] as number;
            const bv = b[key] as number;
            return ascending ? av - bv : bv - av;
          });
        const rankMap: Record<number, number> = {};
        sorted.forEach((t, i) => { rankMap[t.teamId] = i + 1; });
        return rankMap;
      };

      const rankings = {
        runsPerGame: rankStat(merged, "runsPerGame"),
        wrcPlus: rankStat(merged, "wrcPlus"),
        ops: rankStat(merged, "ops"),
        era: rankStat(merged, "era", true),
        fip: rankStat(merged, "fip", true),
        whip: rankStat(merged, "whip", true),
        winPct: rankStat(merged, "winPct"),
      };

      // Sort
      const sortKey = (input?.sortBy || "winPct") as keyof typeof merged[0];
      const ascending = ["era", "fip", "whip"].includes(sortKey);
      merged.sort((a, b) => {
        const av = (a[sortKey] as number) ?? 0;
        const bv = (b[sortKey] as number) ?? 0;
        return ascending ? av - bv : bv - av;
      });

      return { teams: merged, rankings };
    }),

  // ─── Line Movement ────────────────────────────────────────────────────────
  getLineMovement: publicProcedure
    .input(z.object({ gamePk: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { snapshots: [], summary: null };

      const snapshots = await db
        .select()
        .from(oddsSnapshots)
        .where(eq(oddsSnapshots.gamePk, input.gamePk))
        .orderBy(asc(oddsSnapshots.snapshotAt))
        .limit(200);

      if (snapshots.length === 0) return { snapshots: [], summary: null };

      const first = snapshots[0];
      const last = snapshots[snapshots.length - 1];

      const mlMovement = (last.homePrice ?? 0) - (first.homePrice ?? 0);
      const totalMovement = (last.total ?? 0) - (first.total ?? 0);

      // Detect sharp money signals
      const sharpSignals: string[] = [];
      if (Math.abs(mlMovement) >= 10) {
        sharpSignals.push(
          mlMovement > 0
            ? `Home ML moved ${mlMovement > 0 ? "+" : ""}${mlMovement} pts (sharp home action)`
            : `Away ML moved ${Math.abs(mlMovement)} pts (sharp away action)`
        );
      }
      if (Math.abs(totalMovement) >= 0.5) {
        sharpSignals.push(
          totalMovement > 0
            ? `Total moved up ${totalMovement.toFixed(1)} (sharp over action)`
            : `Total moved down ${Math.abs(totalMovement).toFixed(1)} (sharp under action)`
        );
      }

      const summary = {
        openHomeML: first.homePrice,
        openAwayML: first.awayPrice,
        openTotal: first.total,
        openOverPrice: first.overPrice,
        openUnderPrice: first.underPrice,
        currentHomeML: last.homePrice,
        currentAwayML: last.awayPrice,
        currentTotal: last.total,
        currentOverPrice: last.overPrice,
        currentUnderPrice: last.underPrice,
        mlMovement,
        totalMovement,
        snapshotCount: snapshots.length,
        sharpSignals,
        firstSnapshot: first.snapshotAt,
        lastSnapshot: last.snapshotAt,
      };

      return { snapshots, summary };
    }),

  // Snapshot current odds for a game (called on page load to build movement history)
  snapshotOdds: publicProcedure
    .input(
      z.object({
        gamePk: z.number(),
        bookmaker: z.string().optional(),
        homePrice: z.number().optional(),
        awayPrice: z.number().optional(),
        spread: z.number().optional(),
        total: z.number().optional(),
        overPrice: z.number().optional(),
        underPrice: z.number().optional(),
        market: z.enum(["h2h", "spreads", "totals", "player_props"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db.insert(oddsSnapshots).values({
        gamePk: input.gamePk,
        bookmaker: input.bookmaker || "consensus",
        market: (input.market || "h2h") as any,
        homePrice: input.homePrice,
        awayPrice: input.awayPrice,
        spread: input.spread,
        total: input.total,
        overPrice: input.overPrice,
        underPrice: input.underPrice,
      });
      return { ok: true };
    }),

  // Seed team stats for all 30 teams (generates realistic 2026 stats)
  seedTeamStats: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { seeded: 0 };
    const season = 2026;

    // Realistic 2026 team stats based on current MLB performance levels
    const teamStatsData = [
      { teamId: 147, runsPerGame: 5.2, wrcPlus: 118, ops: 0.782, obp: 0.338, slg: 0.444, avg: 0.268, iso: 0.176, babip: 0.301, kPct: 19.2, bbPct: 9.8, hrPerGame: 1.42, era: 3.61, fip: 3.55, xfip: 3.62, whip: 1.18, kPer9: 9.8, bbPer9: 3.1, hrPer9: 1.12, runsPerGameHome: 5.6, runsPerGameAway: 4.8, eraHome: 3.42, eraAway: 3.80, runsPerGameVsL: 5.1, runsPerGameVsR: 5.3, wins: 38, losses: 22, winPct: 0.633, lastTenW: 7, lastTenL: 3, streak: 3 },
      { teamId: 119, runsPerGame: 5.1, wrcPlus: 116, ops: 0.778, obp: 0.336, slg: 0.442, avg: 0.265, iso: 0.177, babip: 0.298, kPct: 20.1, bbPct: 9.4, hrPerGame: 1.38, era: 3.48, fip: 3.42, xfip: 3.51, whip: 1.14, kPer9: 9.6, bbPer9: 2.9, hrPer9: 1.05, runsPerGameHome: 5.4, runsPerGameAway: 4.8, eraHome: 3.31, eraAway: 3.65, runsPerGameVsL: 5.0, runsPerGameVsR: 5.2, wins: 36, losses: 24, winPct: 0.600, lastTenW: 6, lastTenL: 4, streak: 2 },
      { teamId: 144, runsPerGame: 4.9, wrcPlus: 112, ops: 0.762, obp: 0.330, slg: 0.432, avg: 0.261, iso: 0.171, babip: 0.295, kPct: 21.4, bbPct: 8.9, hrPerGame: 1.31, era: 3.72, fip: 3.68, xfip: 3.74, whip: 1.21, kPer9: 9.2, bbPer9: 3.2, hrPer9: 1.18, runsPerGameHome: 5.2, runsPerGameAway: 4.6, eraHome: 3.55, eraAway: 3.89, runsPerGameVsL: 4.8, runsPerGameVsR: 5.0, wins: 34, losses: 26, winPct: 0.567, lastTenW: 6, lastTenL: 4, streak: 1 },
      { teamId: 143, runsPerGame: 5.0, wrcPlus: 114, ops: 0.771, obp: 0.333, slg: 0.438, avg: 0.263, iso: 0.175, babip: 0.297, kPct: 20.8, bbPct: 9.1, hrPerGame: 1.35, era: 3.65, fip: 3.59, xfip: 3.67, whip: 1.19, kPer9: 9.4, bbPer9: 3.0, hrPer9: 1.14, runsPerGameHome: 5.3, runsPerGameAway: 4.7, eraHome: 3.48, eraAway: 3.82, runsPerGameVsL: 4.9, runsPerGameVsR: 5.1, wins: 35, losses: 25, winPct: 0.583, lastTenW: 6, lastTenL: 4, streak: -1 },
      { teamId: 117, runsPerGame: 4.8, wrcPlus: 110, ops: 0.758, obp: 0.328, slg: 0.430, avg: 0.259, iso: 0.171, babip: 0.293, kPct: 22.1, bbPct: 8.7, hrPerGame: 1.28, era: 3.58, fip: 3.52, xfip: 3.61, whip: 1.16, kPer9: 9.5, bbPer9: 2.8, hrPer9: 1.08, runsPerGameHome: 5.0, runsPerGameAway: 4.6, eraHome: 3.41, eraAway: 3.75, runsPerGameVsL: 4.7, runsPerGameVsR: 4.9, wins: 33, losses: 27, winPct: 0.550, lastTenW: 5, lastTenL: 5, streak: 0 },
      { teamId: 111, runsPerGame: 4.7, wrcPlus: 108, ops: 0.752, obp: 0.325, slg: 0.427, avg: 0.257, iso: 0.170, babip: 0.291, kPct: 22.5, bbPct: 8.5, hrPerGame: 1.25, era: 3.82, fip: 3.76, xfip: 3.83, whip: 1.24, kPer9: 9.1, bbPer9: 3.3, hrPer9: 1.22, runsPerGameHome: 4.9, runsPerGameAway: 4.5, eraHome: 3.65, eraAway: 3.99, runsPerGameVsL: 4.6, runsPerGameVsR: 4.8, wins: 32, losses: 28, winPct: 0.533, lastTenW: 5, lastTenL: 5, streak: 2 },
      { teamId: 112, runsPerGame: 4.6, wrcPlus: 106, ops: 0.748, obp: 0.323, slg: 0.425, avg: 0.255, iso: 0.170, babip: 0.290, kPct: 22.8, bbPct: 8.3, hrPerGame: 1.22, era: 3.91, fip: 3.85, xfip: 3.92, whip: 1.26, kPer9: 9.0, bbPer9: 3.4, hrPer9: 1.25, runsPerGameHome: 4.8, runsPerGameAway: 4.4, eraHome: 3.74, eraAway: 4.08, runsPerGameVsL: 4.5, runsPerGameVsR: 4.7, wins: 31, losses: 29, winPct: 0.517, lastTenW: 5, lastTenL: 5, streak: -2 },
      { teamId: 158, runsPerGame: 4.5, wrcPlus: 104, ops: 0.742, obp: 0.320, slg: 0.422, avg: 0.253, iso: 0.169, babip: 0.288, kPct: 23.2, bbPct: 8.1, hrPerGame: 1.19, era: 4.01, fip: 3.95, xfip: 4.02, whip: 1.28, kPer9: 8.8, bbPer9: 3.5, hrPer9: 1.28, runsPerGameHome: 4.7, runsPerGameAway: 4.3, eraHome: 3.84, eraAway: 4.18, runsPerGameVsL: 4.4, runsPerGameVsR: 4.6, wins: 30, losses: 30, winPct: 0.500, lastTenW: 4, lastTenL: 6, streak: 1 },
      { teamId: 138, runsPerGame: 4.4, wrcPlus: 102, ops: 0.738, obp: 0.318, slg: 0.420, avg: 0.251, iso: 0.169, babip: 0.286, kPct: 23.5, bbPct: 7.9, hrPerGame: 1.16, era: 4.12, fip: 4.06, xfip: 4.13, whip: 1.30, kPer9: 8.6, bbPer9: 3.6, hrPer9: 1.31, runsPerGameHome: 4.6, runsPerGameAway: 4.2, eraHome: 3.95, eraAway: 4.29, runsPerGameVsL: 4.3, runsPerGameVsR: 4.5, wins: 29, losses: 31, winPct: 0.483, lastTenW: 4, lastTenL: 6, streak: -3 },
      { teamId: 109, runsPerGame: 4.8, wrcPlus: 109, ops: 0.755, obp: 0.326, slg: 0.429, avg: 0.258, iso: 0.171, babip: 0.292, kPct: 22.3, bbPct: 8.6, hrPerGame: 1.26, era: 3.95, fip: 3.89, xfip: 3.96, whip: 1.27, kPer9: 9.0, bbPer9: 3.3, hrPer9: 1.26, runsPerGameHome: 5.0, runsPerGameAway: 4.6, eraHome: 3.78, eraAway: 4.12, runsPerGameVsL: 4.7, runsPerGameVsR: 4.9, wins: 31, losses: 29, winPct: 0.517, lastTenW: 5, lastTenL: 5, streak: 1 },
      { teamId: 136, runsPerGame: 4.3, wrcPlus: 99, ops: 0.728, obp: 0.314, slg: 0.414, avg: 0.248, iso: 0.166, babip: 0.283, kPct: 24.1, bbPct: 7.6, hrPerGame: 1.12, era: 3.88, fip: 3.82, xfip: 3.89, whip: 1.25, kPer9: 9.2, bbPer9: 3.1, hrPer9: 1.19, runsPerGameHome: 4.5, runsPerGameAway: 4.1, eraHome: 3.71, eraAway: 4.05, runsPerGameVsL: 4.2, runsPerGameVsR: 4.4, wins: 28, losses: 32, winPct: 0.467, lastTenW: 4, lastTenL: 6, streak: -1 },
      { teamId: 135, runsPerGame: 4.2, wrcPlus: 97, ops: 0.722, obp: 0.311, slg: 0.411, avg: 0.246, iso: 0.165, babip: 0.281, kPct: 24.4, bbPct: 7.4, hrPerGame: 1.09, era: 3.72, fip: 3.66, xfip: 3.73, whip: 1.22, kPer9: 9.4, bbPer9: 2.9, hrPer9: 1.15, runsPerGameHome: 4.4, runsPerGameAway: 4.0, eraHome: 3.55, eraAway: 3.89, runsPerGameVsL: 4.1, runsPerGameVsR: 4.3, wins: 27, losses: 33, winPct: 0.450, lastTenW: 3, lastTenL: 7, streak: -2 },
      { teamId: 137, runsPerGame: 4.0, wrcPlus: 93, ops: 0.712, obp: 0.306, slg: 0.406, avg: 0.242, iso: 0.164, babip: 0.277, kPct: 25.1, bbPct: 7.1, hrPerGame: 1.05, era: 3.65, fip: 3.59, xfip: 3.66, whip: 1.20, kPer9: 9.6, bbPer9: 2.7, hrPer9: 1.10, runsPerGameHome: 4.2, runsPerGameAway: 3.8, eraHome: 3.48, eraAway: 3.82, runsPerGameVsL: 3.9, runsPerGameVsR: 4.1, wins: 26, losses: 34, winPct: 0.433, lastTenW: 3, lastTenL: 7, streak: -4 },
      { teamId: 110, runsPerGame: 4.7, wrcPlus: 107, ops: 0.750, obp: 0.324, slg: 0.426, avg: 0.256, iso: 0.170, babip: 0.290, kPct: 22.6, bbPct: 8.4, hrPerGame: 1.23, era: 4.05, fip: 3.99, xfip: 4.06, whip: 1.29, kPer9: 8.7, bbPer9: 3.5, hrPer9: 1.29, runsPerGameHome: 4.9, runsPerGameAway: 4.5, eraHome: 3.88, eraAway: 4.22, runsPerGameVsL: 4.6, runsPerGameVsR: 4.8, wins: 30, losses: 30, winPct: 0.500, lastTenW: 5, lastTenL: 5, streak: 2 },
      { teamId: 141, runsPerGame: 4.5, wrcPlus: 103, ops: 0.740, obp: 0.319, slg: 0.421, avg: 0.252, iso: 0.169, babip: 0.287, kPct: 23.3, bbPct: 8.0, hrPerGame: 1.18, era: 4.18, fip: 4.12, xfip: 4.19, whip: 1.31, kPer9: 8.5, bbPer9: 3.7, hrPer9: 1.33, runsPerGameHome: 4.7, runsPerGameAway: 4.3, eraHome: 4.01, eraAway: 4.35, runsPerGameVsL: 4.4, runsPerGameVsR: 4.6, wins: 29, losses: 31, winPct: 0.483, lastTenW: 4, lastTenL: 6, streak: -1 },
      { teamId: 114, runsPerGame: 4.6, wrcPlus: 105, ops: 0.745, obp: 0.321, slg: 0.424, avg: 0.254, iso: 0.170, babip: 0.289, kPct: 23.0, bbPct: 8.2, hrPerGame: 1.21, era: 4.08, fip: 4.02, xfip: 4.09, whip: 1.30, kPer9: 8.8, bbPer9: 3.5, hrPer9: 1.30, runsPerGameHome: 4.8, runsPerGameAway: 4.4, eraHome: 3.91, eraAway: 4.25, runsPerGameVsL: 4.5, runsPerGameVsR: 4.7, wins: 30, losses: 30, winPct: 0.500, lastTenW: 5, lastTenL: 5, streak: 1 },
      { teamId: 116, runsPerGame: 4.4, wrcPlus: 101, ops: 0.735, obp: 0.317, slg: 0.418, avg: 0.250, iso: 0.168, babip: 0.285, kPct: 23.7, bbPct: 7.8, hrPerGame: 1.14, era: 4.15, fip: 4.09, xfip: 4.16, whip: 1.32, kPer9: 8.6, bbPer9: 3.6, hrPer9: 1.32, runsPerGameHome: 4.6, runsPerGameAway: 4.2, eraHome: 3.98, eraAway: 4.32, runsPerGameVsL: 4.3, runsPerGameVsR: 4.5, wins: 28, losses: 32, winPct: 0.467, lastTenW: 4, lastTenL: 6, streak: -2 },
      { teamId: 118, runsPerGame: 4.3, wrcPlus: 100, ops: 0.730, obp: 0.315, slg: 0.415, avg: 0.249, iso: 0.166, babip: 0.284, kPct: 23.9, bbPct: 7.7, hrPerGame: 1.11, era: 4.22, fip: 4.16, xfip: 4.23, whip: 1.33, kPer9: 8.4, bbPer9: 3.7, hrPer9: 1.35, runsPerGameHome: 4.5, runsPerGameAway: 4.1, eraHome: 4.05, eraAway: 4.39, runsPerGameVsL: 4.2, runsPerGameVsR: 4.4, wins: 27, losses: 33, winPct: 0.450, lastTenW: 4, lastTenL: 6, streak: 1 },
      { teamId: 142, runsPerGame: 4.5, wrcPlus: 104, ops: 0.742, obp: 0.320, slg: 0.422, avg: 0.253, iso: 0.169, babip: 0.288, kPct: 23.2, bbPct: 8.1, hrPerGame: 1.19, era: 3.98, fip: 3.92, xfip: 3.99, whip: 1.27, kPer9: 8.9, bbPer9: 3.4, hrPer9: 1.27, runsPerGameHome: 4.7, runsPerGameAway: 4.3, eraHome: 3.81, eraAway: 4.15, runsPerGameVsL: 4.4, runsPerGameVsR: 4.6, wins: 29, losses: 31, winPct: 0.483, lastTenW: 5, lastTenL: 5, streak: -1 },
      { teamId: 134, runsPerGame: 4.2, wrcPlus: 96, ops: 0.718, obp: 0.309, slg: 0.409, avg: 0.244, iso: 0.165, babip: 0.279, kPct: 24.6, bbPct: 7.3, hrPerGame: 1.07, era: 3.78, fip: 3.72, xfip: 3.79, whip: 1.23, kPer9: 9.3, bbPer9: 2.8, hrPer9: 1.17, runsPerGameHome: 4.4, runsPerGameAway: 4.0, eraHome: 3.61, eraAway: 3.95, runsPerGameVsL: 4.1, runsPerGameVsR: 4.3, wins: 26, losses: 34, winPct: 0.433, lastTenW: 3, lastTenL: 7, streak: -3 },
      { teamId: 108, runsPerGame: 4.1, wrcPlus: 95, ops: 0.715, obp: 0.308, slg: 0.407, avg: 0.243, iso: 0.164, babip: 0.278, kPct: 24.8, bbPct: 7.2, hrPerGame: 1.04, era: 4.28, fip: 4.22, xfip: 4.29, whip: 1.35, kPer9: 8.3, bbPer9: 3.8, hrPer9: 1.37, runsPerGameHome: 4.3, runsPerGameAway: 3.9, eraHome: 4.11, eraAway: 4.45, runsPerGameVsL: 4.0, runsPerGameVsR: 4.2, wins: 25, losses: 35, winPct: 0.417, lastTenW: 3, lastTenL: 7, streak: -2 },
      { teamId: 139, runsPerGame: 4.3, wrcPlus: 99, ops: 0.728, obp: 0.314, slg: 0.414, avg: 0.248, iso: 0.166, babip: 0.283, kPct: 24.1, bbPct: 7.6, hrPerGame: 1.12, era: 4.02, fip: 3.96, xfip: 4.03, whip: 1.28, kPer9: 8.8, bbPer9: 3.5, hrPer9: 1.29, runsPerGameHome: 4.5, runsPerGameAway: 4.1, eraHome: 3.85, eraAway: 4.19, runsPerGameVsL: 4.2, runsPerGameVsR: 4.4, wins: 28, losses: 32, winPct: 0.467, lastTenW: 4, lastTenL: 6, streak: 1 },
      { teamId: 121, runsPerGame: 4.6, wrcPlus: 106, ops: 0.748, obp: 0.323, slg: 0.425, avg: 0.255, iso: 0.170, babip: 0.290, kPct: 22.8, bbPct: 8.3, hrPerGame: 1.22, era: 4.11, fip: 4.05, xfip: 4.12, whip: 1.30, kPer9: 8.7, bbPer9: 3.6, hrPer9: 1.31, runsPerGameHome: 4.8, runsPerGameAway: 4.4, eraHome: 3.94, eraAway: 4.28, runsPerGameVsL: 4.5, runsPerGameVsR: 4.7, wins: 30, losses: 30, winPct: 0.500, lastTenW: 5, lastTenL: 5, streak: 2 },
      { teamId: 120, runsPerGame: 3.9, wrcPlus: 91, ops: 0.705, obp: 0.302, slg: 0.403, avg: 0.239, iso: 0.164, babip: 0.274, kPct: 25.4, bbPct: 6.9, hrPerGame: 1.01, era: 4.45, fip: 4.39, xfip: 4.46, whip: 1.38, kPer9: 8.1, bbPer9: 3.9, hrPer9: 1.42, runsPerGameHome: 4.1, runsPerGameAway: 3.7, eraHome: 4.28, eraAway: 4.62, runsPerGameVsL: 3.8, runsPerGameVsR: 4.0, wins: 24, losses: 36, winPct: 0.400, lastTenW: 3, lastTenL: 7, streak: -5 },
      { teamId: 113, runsPerGame: 4.4, wrcPlus: 102, ops: 0.738, obp: 0.318, slg: 0.420, avg: 0.251, iso: 0.169, babip: 0.286, kPct: 23.5, bbPct: 7.9, hrPerGame: 1.16, era: 4.18, fip: 4.12, xfip: 4.19, whip: 1.31, kPer9: 8.5, bbPer9: 3.7, hrPer9: 1.33, runsPerGameHome: 4.6, runsPerGameAway: 4.2, eraHome: 4.01, eraAway: 4.35, runsPerGameVsL: 4.3, runsPerGameVsR: 4.5, wins: 27, losses: 33, winPct: 0.450, lastTenW: 4, lastTenL: 6, streak: -1 },
      { teamId: 115, runsPerGame: 4.5, wrcPlus: 104, ops: 0.742, obp: 0.320, slg: 0.422, avg: 0.253, iso: 0.169, babip: 0.288, kPct: 23.2, bbPct: 8.1, hrPerGame: 1.19, era: 5.12, fip: 5.06, xfip: 5.13, whip: 1.52, kPer9: 7.8, bbPer9: 4.2, hrPer9: 1.68, runsPerGameHome: 4.7, runsPerGameAway: 4.3, eraHome: 4.95, eraAway: 5.29, runsPerGameVsL: 4.4, runsPerGameVsR: 4.6, wins: 22, losses: 38, winPct: 0.367, lastTenW: 2, lastTenL: 8, streak: -6 },
      { teamId: 133, runsPerGame: 3.8, wrcPlus: 89, ops: 0.698, obp: 0.299, slg: 0.399, avg: 0.237, iso: 0.162, babip: 0.272, kPct: 25.8, bbPct: 6.7, hrPerGame: 0.98, era: 4.52, fip: 4.46, xfip: 4.53, whip: 1.40, kPer9: 8.0, bbPer9: 4.0, hrPer9: 1.45, runsPerGameHome: 4.0, runsPerGameAway: 3.6, eraHome: 4.35, eraAway: 4.69, runsPerGameVsL: 3.7, runsPerGameVsR: 3.9, wins: 21, losses: 39, winPct: 0.350, lastTenW: 2, lastTenL: 8, streak: -4 },
      { teamId: 140, runsPerGame: 4.6, wrcPlus: 106, ops: 0.748, obp: 0.323, slg: 0.425, avg: 0.255, iso: 0.170, babip: 0.290, kPct: 22.8, bbPct: 8.3, hrPerGame: 1.22, era: 4.08, fip: 4.02, xfip: 4.09, whip: 1.29, kPer9: 8.7, bbPer9: 3.5, hrPer9: 1.30, runsPerGameHome: 4.8, runsPerGameAway: 4.4, eraHome: 3.91, eraAway: 4.25, runsPerGameVsL: 4.5, runsPerGameVsR: 4.7, wins: 30, losses: 30, winPct: 0.500, lastTenW: 5, lastTenL: 5, streak: 1 },
      { teamId: 146, runsPerGame: 3.9, wrcPlus: 90, ops: 0.702, obp: 0.301, slg: 0.401, avg: 0.238, iso: 0.163, babip: 0.273, kPct: 25.6, bbPct: 6.8, hrPerGame: 0.99, era: 4.38, fip: 4.32, xfip: 4.39, whip: 1.36, kPer9: 8.2, bbPer9: 3.9, hrPer9: 1.40, runsPerGameHome: 4.1, runsPerGameAway: 3.7, eraHome: 4.21, eraAway: 4.55, runsPerGameVsL: 3.8, runsPerGameVsR: 4.0, wins: 23, losses: 37, winPct: 0.383, lastTenW: 3, lastTenL: 7, streak: -3 },
      { teamId: 145, runsPerGame: 3.7, wrcPlus: 87, ops: 0.692, obp: 0.296, slg: 0.396, avg: 0.234, iso: 0.162, babip: 0.269, kPct: 26.2, bbPct: 6.5, hrPerGame: 0.95, era: 4.62, fip: 4.56, xfip: 4.63, whip: 1.42, kPer9: 7.9, bbPer9: 4.1, hrPer9: 1.48, runsPerGameHome: 3.9, runsPerGameAway: 3.5, eraHome: 4.45, eraAway: 4.79, runsPerGameVsL: 3.6, runsPerGameVsR: 3.8, wins: 20, losses: 40, winPct: 0.333, lastTenW: 2, lastTenL: 8, streak: -7 },
    ];

    let seeded = 0;
    for (const row of teamStatsData) {
      await db.insert(teamStats).values({ ...row, season } as any)
        .onDuplicateKeyUpdate({ set: { runsPerGame: row.runsPerGame, winPct: row.winPct, era: row.era } });
      seeded++;
    }
    return { seeded };
  }),

  // Health-check probe — confirms the router is reachable and data pipeline is live
  // AGENTS.md: This is a safe example of adding a new procedure. Follow this pattern.
  healthCheck: publicProcedure.query(async () => {
    const today = new Date().toISOString().split("T")[0];
    return {
      status: "ok",
      timestamp: Date.now(),
      date: today,
      message: "MLB Edge data pipeline is live",
    };
  }),

  /**
   * Public daily free pick — no auth required.
   * Returns the single highest-edge A/B-tier pick for today.
   * Used on the /free-pick page and landing page preview.
   */
  getFreePick: publicProcedure.query(async () => {
    return cached("freePick:today", TTL.picks, async () => {
      const date = new Date().toISOString().split("T")[0];
      const [schedule, oddsData] = await Promise.all([
        fetchTodaysSchedule(date),
        fetchMLBOdds("h2h,spreads,totals").catch(() => []),
      ]);
      if (!schedule.length) return null;
      const { teamStatsMap, pitcherStatsMap, weatherMap } = await fetchAllGameData(schedule);
      let bestPick: any = null;
      let bestEdge = -Infinity;
      for (const game of schedule) {
        const homeTeamId = game.teams?.home?.team?.id;
        const awayTeamId = game.teams?.away?.team?.id;
        const homeTeamName = game.teams?.home?.team?.name || "";
        const awayTeamName = game.teams?.away?.team?.name || "";
        const homeAbbr = TEAM_ABBR_MAP[homeTeamId] || "???";
        const awayAbbr = TEAM_ABBR_MAP[awayTeamId] || "???";
        const homePitcher = game.teams?.home?.probablePitcher?.fullName;
        const awayPitcher = game.teams?.away?.probablePitcher?.fullName;
        const oddsGame = matchOddsGame(game, oddsData);
        const features = buildGameFeaturesSync(
          game, oddsGame,
          teamStatsMap.get(homeTeamId),
          teamStatsMap.get(awayTeamId),
          pitcherStatsMap.get(game.teams?.home?.probablePitcher?.id),
          pitcherStatsMap.get(game.teams?.away?.probablePitcher?.id),
          weatherMap.get(game.gamePk)
        );
        const analysis = analyzeGame(features);
        const topPick = analysis.topPick;
        if (!topPick) continue;
        if (topPick.confidenceTier !== "A" && topPick.confidenceTier !== "B") continue;
        if ((topPick.edgeScore ?? 0) > bestEdge) {
          bestEdge = topPick.edgeScore ?? 0;
          const normalized = normalizePick(topPick, game.gamePk, homeTeamName, awayTeamName, homeAbbr, awayAbbr, game.gameDate, homePitcher, awayPitcher);
          if (normalized) {
            bestPick = {
              ...normalized,
              homeTeam: homeTeamName,
              awayTeam: awayTeamName,
              homeAbbr,
              awayAbbr,
              gameDate: game.gameDate,
              homePitcher: homePitcher || null,
              awayPitcher: awayPitcher || null,
              date,
            };
          }
        }
      }
      return bestPick;
    });
  }),

  /**
   * Public win/loss record — no auth required.
   * Returns last N days of parlay card results for social proof.
   */
  getPublicRecord: publicProcedure
    .input(z.object({ days: z.number().min(1).max(30).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { wins: 0, losses: 0, pushes: 0, winPct: null, totalGraded: 0, recentResults: [] };
      const days = input?.days ?? 14;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      const allCards = await db
        .select()
        .from(parlayCards)
        .orderBy(desc(parlayCards.date));
      const filtered = allCards.filter((c) => {
        const d = typeof c.date === "string" ? c.date : (c.date as Date).toISOString().split("T")[0];
        return d >= cutoffStr && (c.result === "win" || c.result === "loss" || c.result === "push");
      });
      const wins = filtered.filter((c) => c.result === "win").length;
      const losses = filtered.filter((c) => c.result === "loss").length;
      const pushes = filtered.filter((c) => c.result === "push").length;
      const totalGraded = wins + losses + pushes;
      const winPct = totalGraded > 0 ? Math.round((wins / totalGraded) * 100) : null;
      const recentResults = filtered.slice(0, 5).map((c) => ({
        date: typeof c.date === "string" ? c.date : (c.date as Date).toISOString().split("T")[0],
        type: c.type as string,
        result: c.result as string,
        combinedOdds: c.combinedOdds,
      }));
      return { wins, losses, pushes, winPct, totalGraded, recentResults };
    }),

  // Seed mock backtest data
  seedBacktestData: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { seeded: 0 };
    const mockData = [
      { market: "moneyline", confidenceTier: "A", season: 2024, totalPicks: 142, wins: 89, losses: 53, pushes: 0, winPct: 0.627, roi: 18.4, avgEdge: 0.091, avgOdds: -108 },
      { market: "moneyline", confidenceTier: "B", season: 2024, totalPicks: 287, wins: 163, losses: 124, pushes: 0, winPct: 0.568, roi: 9.2, avgEdge: 0.063, avgOdds: -112 },
      { market: "moneyline", confidenceTier: "C", season: 2024, totalPicks: 431, wins: 228, losses: 203, pushes: 0, winPct: 0.529, roi: 2.1, avgEdge: 0.038, avgOdds: -115 },
      { market: "total", confidenceTier: "A", season: 2024, totalPicks: 98, wins: 61, losses: 35, pushes: 2, winPct: 0.635, roi: 21.3, avgEdge: 0.094, avgOdds: -110 },
      { market: "total", confidenceTier: "B", season: 2024, totalPicks: 203, wins: 117, losses: 86, pushes: 0, winPct: 0.576, roi: 11.8, avgEdge: 0.067, avgOdds: -110 },
      { market: "runline", confidenceTier: "A", season: 2024, totalPicks: 76, wins: 46, losses: 30, pushes: 0, winPct: 0.605, roi: 14.7, avgEdge: 0.082, avgOdds: -118 },
      { market: "runline", confidenceTier: "B", season: 2024, totalPicks: 189, wins: 104, losses: 85, pushes: 0, winPct: 0.550, roi: 5.9, avgEdge: 0.056, avgOdds: -120 },
    ];

    for (const row of mockData) {
      await db.insert(backtestResults).values(row as any).onDuplicateKeyUpdate({ set: { roi: row.roi } });
    }

    return { seeded: mockData.length };
  }),
});
