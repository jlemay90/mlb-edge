/**
 * Project-level Heartbeat handler: pre-warms the data cache and snapshots
 * current odds so the dashboard is instant for the first visitor each interval
 * and line-movement history accumulates without depending on user page-loads.
 *
 * Mounted at POST /api/scheduled/refresh in server/_core/index.ts.
 * Created via `manus-heartbeat create` after deploy (dev sandbox is unreachable
 * to the platform scheduler).
 */

import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { oddsSnapshots } from "../../drizzle/schema";
import { invalidate } from "../services/cache";
import { fetchTodaysSchedule, fetchMLBOdds, fetchMLBPlayerProps, STADIUM_DATA, getUmpireTendency, fetchGameWeather } from "../services/mlbData";
import { analyzeGame } from "../services/predictionEngine";
import { generateDailyParlays } from "../services/parlayEngine";
import { parlayCards, parlayLegs } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

// Match an Odds API game to an MLB schedule game by team name (mirrors
// matchOddsGame in mlbRouter, kept local to avoid a router import cycle).
function matchOddsGame(og: any, homeName: string, awayName: string): boolean {
  if (og.home_team === homeName || og.away_team === awayName) return true;
  const homeLast = homeName.split(" ").pop() || "";
  const teams =
    og.bookmakers?.[0]?.markets?.[0]?.outcomes?.map((o: any) => o.name) || [];
  return teams.some(
    (t: string) => t.includes(homeLast) || homeLast.includes(t.split(" ").pop() || "")
  );
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export async function scheduledRefreshHandler(req: Request, res: Response) {
  try {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      // Missing/invalid session => not an authenticated cron caller.
      return res.status(403).json({ error: "cron-only" });
    }
    if (!user?.isCron || !user?.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const date = todayStr();

    // 1. Bust today's cached aggregates so the next read recomputes fresh.
    invalidate(`todaysGames:${date}`);
    for (const market of ["all", "moneyline", "runline", "total"]) {
      for (const tier of ["A", "B", "C", "D"]) {
        invalidate(`topPicks:${date}:${market}:${tier}`);
      }
    }

    // 2. Pull schedule + live odds and snapshot moneyline/total per game so the
    //    line-movement charts build history automatically.
    const [schedule, oddsData] = await Promise.all([
      fetchTodaysSchedule(date),
      fetchMLBOdds("h2h,spreads,totals").catch(() => []),
    ]);

    let snapshots = 0;
    const db = await getDb();

    if (db && schedule.length && Array.isArray(oddsData) && oddsData.length) {
      for (const game of schedule) {
        const homeName = game?.teams?.home?.team?.name || "";
        const awayName = game?.teams?.away?.team?.name || "";
        const og = oddsData.find((o: any) =>
          matchOddsGame(o, homeName, awayName)
        );
        if (!og) continue;

        // Pull consensus prices from the first available bookmaker.
        const book = og.bookmakers?.[0];
        if (!book) continue;

        const h2h = book.markets?.find((m: any) => m.key === "h2h");
        const totals = book.markets?.find((m: any) => m.key === "totals");

        const homePrice = h2h?.outcomes?.find(
          (o: any) => o.name === homeName
        )?.price;
        const awayPrice = h2h?.outcomes?.find(
          (o: any) => o.name === awayName
        )?.price;
        const overOutcome = totals?.outcomes?.find(
          (o: any) => o.name === "Over"
        );

        try {
          await db.insert(oddsSnapshots).values({
            gamePk: game.gamePk,
            bookmaker: book.key || "consensus",
            market: "h2h" as any,
            homePrice: typeof homePrice === "number" ? homePrice : undefined,
            awayPrice: typeof awayPrice === "number" ? awayPrice : undefined,
            total:
              typeof overOutcome?.point === "number"
                ? overOutcome.point
                : undefined,
            overPrice:
              typeof overOutcome?.price === "number"
                ? overOutcome.price
                : undefined,
          });
          snapshots++;
        } catch {
          // Skip a single bad row rather than failing the whole job.
        }
      }
    }

    // 3. Generate today's parlays if not already done
    let parlaysGenerated = 0;
    if (db && schedule.length) {
      const existing = await db
        .select({ id: parlayCards.id })
        .from(parlayCards)
        .where(eq(parlayCards.date, new Date(date)))
        .limit(1);

      if (existing.length === 0) {
        try {
          // Enrich games with predictions
          const rawProps = await fetchMLBPlayerProps("player_props").catch(() => []);
          const enriched: any[] = [];
          for (const game of schedule) {
            const homeTeamId = game.teams?.home?.team?.id;
            const stadiumInfo = (STADIUM_DATA as any)[homeTeamId];
            let weather: any = null;
            if (stadiumInfo) {
              weather = await fetchGameWeather(
                game.gamePk, stadiumInfo.lat, stadiumInfo.lon,
                stadiumInfo.altFt, process.env.OPENWEATHER_API_KEY
              ).catch(() => null);
            }
            const oddsGame = (Array.isArray(oddsData) ? oddsData : []).find((o: any) => {
              const homeLast = (game.teams?.home?.team?.name || "").split(" ").pop() || "";
              if (o.home_team === game.teams?.home?.team?.name) return true;
              const teams = o.bookmakers?.[0]?.markets?.[0]?.outcomes?.map((x: any) => x.name) || [];
              return teams.some((t: string) => t.includes(homeLast));
            });
            const features: any = {
              homeTeamId: homeTeamId || 0,
              awayTeamId: game.teams?.away?.team?.id || 0,
              homeTeamName: game.teams?.home?.team?.name || "",
              awayTeamName: game.teams?.away?.team?.name || "",
              homeML: oddsGame?.bookmakers?.[0]?.markets?.find((m: any) => m.key === "h2h")?.outcomes?.find((o: any) => o.name === game.teams?.home?.team?.name)?.price ?? -110,
              awayML: oddsGame?.bookmakers?.[0]?.markets?.find((m: any) => m.key === "h2h")?.outcomes?.find((o: any) => o.name === game.teams?.away?.team?.name)?.price ?? -110,
              homeSpread: -1.5, awaySpread: 1.5,
              homeSpreadOdds: oddsGame?.bookmakers?.[0]?.markets?.find((m: any) => m.key === "spreads")?.outcomes?.find((o: any) => o.name === game.teams?.home?.team?.name)?.price ?? -110,
              awaySpreadOdds: oddsGame?.bookmakers?.[0]?.markets?.find((m: any) => m.key === "spreads")?.outcomes?.find((o: any) => o.name === game.teams?.away?.team?.name)?.price ?? -110,
              total: oddsGame?.bookmakers?.[0]?.markets?.find((m: any) => m.key === "totals")?.outcomes?.[0]?.point ?? 8.5,
              overOdds: -110, underOdds: -110,
              weather: weather ? { temp: weather.temp, windSpeed: weather.windSpeed, windDir: weather.windDir, humidity: weather.humidity } : undefined,
              parkFactor: stadiumInfo ? { runs: stadiumInfo.parkFactorRuns, hr: stadiumInfo.parkFactorHR } : undefined,
              umpire: getUmpireTendency(game.officials?.find((o: any) => o.officialType === "Home Plate")?.official?.fullName || "default"),
            };
            const analysis = analyzeGame(features);
            enriched.push({
              gamePk: game.gamePk, gameDate: date,
              homeTeam: { id: homeTeamId, name: game.teams?.home?.team?.name },
              awayTeam: { id: game.teams?.away?.team?.id, name: game.teams?.away?.team?.name },
              homePitcher: game.teams?.home?.probablePitcher ? { name: game.teams.home.probablePitcher.fullName, era: 4.0, fip: 4.0 } : null,
              awayPitcher: game.teams?.away?.probablePitcher ? { name: game.teams.away.probablePitcher.fullName, era: 4.0, fip: 4.0 } : null,
              weather, parkFactor: stadiumInfo, predictions: analysis,
            });
          }

          const parlays = generateDailyParlays(enriched, Array.isArray(rawProps) ? rawProps : []);
          const now = Date.now();
          for (const parlay of parlays) {
            const [inserted] = await db.insert(parlayCards).values({
              date: new Date(date), type: parlay.type,
              legs: parlay.legs as any, combinedOdds: parlay.combinedOdds,
              totalLegs: parlay.totalLegs, reasoning: parlay.reasoning,
              result: "pending", legsWon: 0, legsLost: 0, generatedAt: now,
            });
            const cardId = (inserted as any).insertId;
            if (!cardId) continue;
            for (const leg of parlay.legs) {
              await db.insert(parlayLegs).values({
                parlayCardId: cardId, gamePk: leg.gamePk,
                gameDate: new Date(leg.gameDate), homeTeam: leg.homeTeam,
                awayTeam: leg.awayTeam, market: leg.market, pick: leg.pick,
                pickLabel: leg.pickLabel, odds: leg.odds,
                edgeScore: leg.edgeScore, modelProbability: leg.modelProbability,
                reasoning: leg.reasoning, result: "pending",
              });
            }
            parlaysGenerated++;
          }
        } catch (parlayErr) {
          console.error("[scheduled] Parlay generation failed:", (parlayErr as Error).message);
        }
      }
    }

    return res.json({
      ok: true,
      date,
      games: schedule.length,
      oddsGames: Array.isArray(oddsData) ? oddsData.length : 0,
      snapshots,
      parlaysGenerated,
      timestamp: Date.now(),
    });
  } catch (err) {
    const e = err as Error;
    return res.status(500).json({
      error: e.message,
      stack: e.stack,
      context: { url: req.originalUrl, taskUid: (req as any)?.taskUid },
      timestamp: Date.now(),
    });
  }
}
