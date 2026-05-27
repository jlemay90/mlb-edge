/**
 * MLB Edge — tRPC Router
 * Exposes all MLB data, predictions, and analytics to the frontend
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  mlbGames,
  mlbTeams,
  predictions,
  playerProps,
  oddsSnapshots,
  weatherCache,
  teamStats,
  pitcherStats,
  umpireTendencies,
  backtestResults,
} from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  fetchTodaysSchedule,
  fetchMLBOdds,
  fetchMLBEvents,
  fetchMLBPlayerProps,
  fetchAllTeams,
  fetchTeamStats,
  STADIUM_DATA,
  ODDS_TEAM_MAP,
  TEAM_ABBR_MAP,
  getUmpireTendency,
  fetchGameWeather,
} from "./services/mlbData";
import {
  analyzeGame,
  predictProp,
  GameFeatures,
  americanToImplied,
} from "./services/predictionEngine";

// ─── Helper: Build Game Features ─────────────────────────────────────────────

async function buildGameFeatures(game: any, oddsGame: any): Promise<GameFeatures> {
  const homeTeamId = game.teams?.home?.team?.id;
  const awayTeamId = game.teams?.away?.team?.id;
  const homeTeamName = game.teams?.home?.team?.name || "Home";
  const awayTeamName = game.teams?.away?.team?.name || "Away";

  // Get stadium data
  const stadiumInfo = STADIUM_DATA[homeTeamId] || null;

  // Get weather
  let weather = null;
  if (stadiumInfo) {
    weather = await fetchGameWeather(
      game.gamePk,
      stadiumInfo.lat,
      stadiumInfo.lon,
      stadiumInfo.altFt,
      process.env.OPENWEATHER_API_KEY
    );
  }

  // Get umpire
  const umpireName = game.officials?.find((o: any) => o.officialType === "Home Plate")?.official?.fullName;
  const umpireTendency = getUmpireTendency(umpireName || "default");

  // Get team stats from DB
  const season = new Date().getFullYear();
  const db = await getDb();
  const homeStats = db ? await db
    .select()
    .from(teamStats)
    .where(and(eq(teamStats.teamId, homeTeamId), eq(teamStats.season, season)))
    .limit(1) : [];
  const awayStats = db ? await db
    .select()
    .from(teamStats)
    .where(and(eq(teamStats.teamId, awayTeamId), eq(teamStats.season, season)))
    .limit(1) : [];

  const homeTeamStats = homeStats[0];
  const awayTeamStats = awayStats[0];

  // Get pitcher stats
  const homePitcherId = game.teams?.home?.probablePitcher?.id;
  const awayPitcherId = game.teams?.away?.probablePitcher?.id;

  const homePitcherData = (homePitcherId && db)
    ? await db
        .select()
        .from(pitcherStats)
        .where(and(eq(pitcherStats.playerId, homePitcherId), eq(pitcherStats.season, season)))
        .limit(1)
    : [];
  const awayPitcherData = (awayPitcherId && db)
    ? await db
        .select()
        .from(pitcherStats)
        .where(and(eq(pitcherStats.playerId, awayPitcherId), eq(pitcherStats.season, season)))
        .limit(1)
    : [];

  const homePitcher = homePitcherData[0];
  const awayPitcher = awayPitcherData[0];

  // Parse odds
  let homeMoneyLine: number | undefined;
  let awayMoneyLine: number | undefined;
  let total: number | undefined;
  let overPrice: number | undefined;
  let underPrice: number | undefined;

  if (oddsGame) {
    const h2hMarket = oddsGame.bookmakers?.[0]?.markets?.find((m: any) => m.key === "h2h");
    const totalsMarket = oddsGame.bookmakers?.[0]?.markets?.find((m: any) => m.key === "totals");

    if (h2hMarket) {
      const homeOutcome = h2hMarket.outcomes?.find((o: any) => o.name === homeTeamName || o.name?.includes(homeTeamName?.split(" ").pop()));
      const awayOutcome = h2hMarket.outcomes?.find((o: any) => o.name === awayTeamName || o.name?.includes(awayTeamName?.split(" ").pop()));
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
  }

  return {
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    homePitcherName: game.teams?.home?.probablePitcher?.fullName,
    awayPitcherName: game.teams?.away?.probablePitcher?.fullName,
    // Pitchers
    homePitcherFIP: homePitcher?.fip ?? undefined,
    awayPitcherFIP: awayPitcher?.fip ?? undefined,
    homePitcherXFIP: homePitcher?.xfip ?? undefined,
    awayPitcherXFIP: awayPitcher?.xfip ?? undefined,
    homePitcherKPct: homePitcher?.kPct ?? undefined,
    awayPitcherKPct: awayPitcher?.kPct ?? undefined,
    homePitcherBBPct: homePitcher?.bbPct ?? undefined,
    awayPitcherBBPct: awayPitcher?.bbPct ?? undefined,
    homePitcherLast3ERA: homePitcher?.last3GamesEra ?? undefined,
    awayPitcherLast3ERA: awayPitcher?.last3GamesEra ?? undefined,
    homePitcherDaysSinceStart: homePitcher?.daysSinceLastStart ?? undefined,
    awayPitcherDaysSinceStart: awayPitcher?.daysSinceLastStart ?? undefined,
    // Team offense
    homeTeamWRCPlus: homeTeamStats?.wrcPlus ?? undefined,
    awayTeamWRCPlus: awayTeamStats?.wrcPlus ?? undefined,
    homeTeamOPS: homeTeamStats?.ops ?? undefined,
    awayTeamOPS: awayTeamStats?.ops ?? undefined,
    homeTeamRunsPerGame: homeTeamStats?.runsPerGame ?? undefined,
    awayTeamRunsPerGame: awayTeamStats?.runsPerGame ?? undefined,
    homeTeamKPct: homeTeamStats?.kPct ?? undefined,
    awayTeamKPct: awayTeamStats?.kPct ?? undefined,
    homeTeamBBPct: homeTeamStats?.bbPct ?? undefined,
    awayTeamBBPct: awayTeamStats?.bbPct ?? undefined,
    // Team defense
    homeTeamERA: homeTeamStats?.era ?? undefined,
    awayTeamERA: awayTeamStats?.era ?? undefined,
    homeTeamFIP: homeTeamStats?.fip ?? undefined,
    awayTeamFIP: awayTeamStats?.fip ?? undefined,
    homeTeamXFIP: homeTeamStats?.xfip ?? undefined,
    awayTeamXFIP: awayTeamStats?.xfip ?? undefined,
    homeTeamWHIP: homeTeamStats?.whip ?? undefined,
    awayTeamWHIP: awayTeamStats?.whip ?? undefined,
    // Record
    homeTeamWinPct: homeTeamStats?.winPct ?? undefined,
    awayTeamWinPct: awayTeamStats?.winPct ?? undefined,
    homeTeamLastTenWins: homeTeamStats?.lastTenW ?? undefined,
    awayTeamLastTenWins: awayTeamStats?.lastTenW ?? undefined,
    homeTeamStreak: homeTeamStats?.streak ?? undefined,
    awayTeamStreak: awayTeamStats?.streak ?? undefined,
    // Splits
    homeTeamRunsPerGameHome: homeTeamStats?.runsPerGameHome ?? undefined,
    awayTeamRunsPerGameAway: awayTeamStats?.runsPerGameAway ?? undefined,
    homeTeamERAHome: homeTeamStats?.eraHome ?? undefined,
    awayTeamERAAway: awayTeamStats?.eraAway ?? undefined,
    // Park
    parkFactorRuns: stadiumInfo?.parkFactorRuns,
    parkFactorHR: stadiumInfo?.parkFactorHR,
    altitudeFt: stadiumInfo?.altFt,
    // Weather
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
  };
}

// ─── MLB Router ───────────────────────────────────────────────────────────────

export const mlbRouter = router({
  // Get today's games with live odds and predictions
  getTodaysGames: publicProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const date = input?.date || new Date().toISOString().split("T")[0];

      // Fetch schedule and odds in parallel
      const [schedule, oddsData] = await Promise.all([
        fetchTodaysSchedule(date),
        fetchMLBOdds("h2h,spreads,totals").catch(() => []),
      ]);

      const games = await Promise.all(
        schedule.map(async (game: any) => {
          const homeTeamName = game.teams?.home?.team?.name || "";
          const awayTeamName = game.teams?.away?.team?.name || "";

          // Match odds game by team name
          const oddsGame = oddsData.find((og: any) => {
            const teams = og.bookmakers?.[0]?.markets?.[0]?.outcomes?.map((o: any) => o.name) || [];
            return teams.some(
              (t: string) =>
                homeTeamName.includes(t.split(" ").pop() || "") ||
                t.includes(homeTeamName.split(" ").pop() || "")
            );
          });

          const features = await buildGameFeatures(game, oddsGame);
          const analysis = analyzeGame(features);

          const stadiumInfo = STADIUM_DATA[game.teams?.home?.team?.id];

          return {
            gamePk: game.gamePk,
            gameDate: date,
            gameTime: game.gameDate,
            status: game.status?.detailedState || "Scheduled",
            homeTeam: {
              id: game.teams?.home?.team?.id,
              name: homeTeamName,
              abbreviation: TEAM_ABBR_MAP[game.teams?.home?.team?.id] || "???",
              score: game.teams?.home?.score,
              record: game.teams?.home?.leagueRecord
                ? `${game.teams.home.leagueRecord.wins}-${game.teams.home.leagueRecord.losses}`
                : undefined,
            },
            awayTeam: {
              id: game.teams?.away?.team?.id,
              name: awayTeamName,
              abbreviation: TEAM_ABBR_MAP[game.teams?.away?.team?.id] || "???",
              score: game.teams?.away?.score,
              record: game.teams?.away?.leagueRecord
                ? `${game.teams.away.leagueRecord.wins}-${game.teams.away.leagueRecord.losses}`
                : undefined,
            },
            venue: game.venue?.name || stadiumInfo?.name,
            homePitcher: game.teams?.home?.probablePitcher?.fullName,
            awayPitcher: game.teams?.away?.probablePitcher?.fullName,
            umpire: game.officials?.find((o: any) => o.officialType === "Home Plate")?.official?.fullName,
            odds: {
              homeMoneyLine: features.homeMoneyLine,
              awayMoneyLine: features.awayMoneyLine,
              total: features.total,
              overPrice: features.overPrice,
              underPrice: features.underPrice,
            },
            weather: features.tempF
              ? {
                  tempF: features.tempF,
                  windSpeedMph: features.windSpeedMph,
                  windDirLabel: features.windDirLabel,
                  conditions: "Clear",
                  runImpact: features.weatherRunImpact,
                }
              : null,
            parkFactor: {
              runs: features.parkFactorRuns,
              hr: features.parkFactorHR,
            },
            predictions: {
              moneyLine: analysis.moneyLine,
              runLine: analysis.runLine,
              total: analysis.total,
              topPick: analysis.topPick,
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

      const allPicks: any[] = [];

      for (const game of schedule) {
        const homeTeamName = game.teams?.home?.team?.name || "";
        const oddsGame = oddsData.find((og: any) => {
          const teams = og.bookmakers?.[0]?.markets?.[0]?.outcomes?.map((o: any) => o.name) || [];
          return teams.some(
            (t: string) =>
              homeTeamName.includes(t.split(" ").pop() || "") ||
              t.includes(homeTeamName.split(" ").pop() || "")
          );
        });

        const features = await buildGameFeatures(game, oddsGame);
        const analysis = analyzeGame(features);

        const picks = [analysis.moneyLine, analysis.runLine, analysis.total].filter(Boolean);
        for (const pick of picks) {
          if (!pick) continue;
          if (input?.market && input.market !== "all" && pick.market !== input.market) continue;
          const tierOrder = { A: 0, B: 1, C: 2, D: 3 };
          const minTier = input?.minTier || "D";
          if (tierOrder[pick.confidenceTier] > tierOrder[minTier]) continue;

          allPicks.push({
            gamePk: game.gamePk,
            gameDate: date,
            homeTeam: game.teams?.home?.team?.name,
            awayTeam: game.teams?.away?.team?.name,
            homeAbbr: TEAM_ABBR_MAP[game.teams?.home?.team?.id] || "???",
            awayAbbr: TEAM_ABBR_MAP[game.teams?.away?.team?.id] || "???",
            gameTime: game.gameDate,
            homePitcher: game.teams?.home?.probablePitcher?.fullName,
            awayPitcher: game.teams?.away?.probablePitcher?.fullName,
            ...pick,
          });
        }
      }

      return allPicks.sort((a, b) => b.edgeScore - a.edgeScore);
    }),

  // Get player props for today
  getPlayerProps: publicProcedure
    .input(z.object({ date: z.string().optional() }).optional())
    .query(async () => {
      const events = await fetchMLBEvents().catch(() => []);
      const allProps: any[] = [];

      for (const event of events.slice(0, 5)) {
        // Limit to avoid rate limits
        const propsData = await fetchMLBPlayerProps(event.id).catch(() => null);
        if (!propsData) continue;

        for (const bookmaker of propsData.bookmakers?.slice(0, 1) || []) {
          for (const market of bookmaker.markets || []) {
            for (const outcome of market.outcomes || []) {
              const overOutcome = market.outcomes.find(
                (o: any) => o.name === "Over" && o.description === outcome.description
              );
              const underOutcome = market.outcomes.find(
                (o: any) => o.name === "Under" && o.description === outcome.description
              );

              if (outcome.name !== "Over") continue;
              if (!overOutcome || !underOutcome) continue;

              const propResult = predictProp({
                playerName: outcome.description || "Unknown",
                propType: market.key,
                line: outcome.point || 0,
                overOdds: overOutcome.price || -110,
                underOdds: underOutcome.price || -110,
              });

              if (propResult.pick === "pass") continue;

              allProps.push({
                eventId: event.id,
                homeTeam: event.home_team,
                awayTeam: event.away_team,
                playerName: outcome.description,
                propType: market.key,
                line: outcome.point,
                overOdds: overOutcome.price,
                underOdds: underOutcome.price,
                ...propResult,
              });
            }
          }
        }
      }

      return allProps.sort((a, b) => b.edgeScore - a.edgeScore);
    }),

  // Get team stats
  getTeamStats: publicProcedure
    .input(z.object({ season: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const season = input?.season || new Date().getFullYear();
      const db = await getDb();
      if (!db) return [];
      const stats = await db
        .select()
        .from(teamStats)
        .where(eq(teamStats.season, season))
        .orderBy(desc(teamStats.winPct));
      return stats;
    }),

  // Get backtest results
  getBacktestResults: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const results = await db.select().from(backtestResults).orderBy(desc(backtestResults.roi));
    return results;
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
          set: {
            name: team.name,
            abbreviation: team.abbreviation,
            venue: team.venue?.name,
          },
        });
      seeded++;
    }

    return { seeded };
  }),

  // Seed mock backtest data for display
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
