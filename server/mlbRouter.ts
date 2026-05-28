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
} from "../drizzle/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
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

function buildGameFeaturesSync(
  game: any,
  oddsGame: any,
  homeTeamStatsRow: any,
  awayTeamStatsRow: any,
  homePitcherRow: any,
  awayPitcherRow: any,
  weather: any
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
    if (spreadsMarket) {
      const homeSpread = spreadsMarket.outcomes?.find(
        (o: any) => o.name === homeTeamName || o.name?.includes(homeTeamName?.split(" ").pop())
      );
      const awaySpread = spreadsMarket.outcomes?.find(
        (o: any) => o.name === awayTeamName || o.name?.includes(awayTeamName?.split(" ").pop())
      );
      if (homeSpread) {
        runLine = homeSpread.point; // e.g. -1.5
        homeRunLineOdds = homeSpread.price;
      }
      if (awaySpread) {
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

  // Fetch weather for all games in parallel
  const weatherMap = new Map<number, any>();
  await Promise.all(
    schedule.map(async (game) => {
      const homeId = game.teams?.home?.team?.id;
      const stadiumInfo = STADIUM_DATA[homeId];
      if (stadiumInfo) {
        const w = await fetchGameWeather(
          game.gamePk,
          stadiumInfo.lat,
          stadiumInfo.lon,
          stadiumInfo.altFt,
          process.env.OPENWEATHER_API_KEY
        );
        if (w) weatherMap.set(game.gamePk, w);
      }
    })
  );

  return { teamStatsMap, pitcherStatsMap, weatherMap };
}

// ─── Match odds game by team name ─────────────────────────────────────────────

function matchOddsGame(game: any, oddsData: any[]): any {
  const homeTeamName = game.teams?.home?.team?.name || "";
  const awayTeamName = game.teams?.away?.team?.name || "";
  const homeLast = homeTeamName.split(" ").pop() || "";
  const awayLast = awayTeamName.split(" ").pop() || "";

  return oddsData.find((og: any) => {
    if (og.home_team === homeTeamName || og.away_team === awayTeamName) return true;
    const teams = og.bookmakers?.[0]?.markets?.[0]?.outcomes?.map((o: any) => o.name) || [];
    return teams.some(
      (t: string) => t.includes(homeLast) || homeLast.includes(t.split(" ").pop() || "")
    );
  });
}

// ─── MLB Router ───────────────────────────────────────────────────────────────

export const mlbRouter = router({
  // Get today's games with live odds, predictions, weather, umpire, park factors
  getTodaysGames: publicProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const date = input?.date || new Date().toISOString().split("T")[0];

      const [schedule, oddsData] = await Promise.all([
        fetchTodaysSchedule(date),
        fetchMLBOdds("h2h,spreads,totals").catch(() => []),
      ]);

      if (!schedule.length) return [];

      const { teamStatsMap, pitcherStatsMap, weatherMap } = await fetchAllGameData(schedule);

      const games = await Promise.all(
        schedule.map(async (game: any) => {
          const homeTeamId = game.teams?.home?.team?.id;
          const awayTeamId = game.teams?.away?.team?.id;
          const homeTeamName = game.teams?.home?.team?.name || "";
          const awayTeamName = game.teams?.away?.team?.name || "";
          const oddsGame = matchOddsGame(game, oddsData);
          const stadiumInfo = STADIUM_DATA[homeTeamId];
          const weather = weatherMap.get(game.gamePk);

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
            weather
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
