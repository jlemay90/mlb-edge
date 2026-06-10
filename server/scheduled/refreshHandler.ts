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
import { fetchTodaysSchedule, fetchMLBOdds, fetchMLBPlayerProps, fetchMLBEvents, STADIUM_DATA, getUmpireTendency, fetchGameWeather, fetchBullpenStatus, fetchConfirmedLineups, fetchPitcherRecentForm } from "../services/mlbData";
import { analyzeGame } from "../services/predictionEngine";
import { generateDailyParlays } from "../services/parlayEngine";
import { buildGameFeaturesSync } from "../mlbRouter";
import { parlayCards, parlayLegs } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

// Match an Odds API game to an MLB schedule game by team name.
// MUST match BOTH home AND away to prevent false positives (e.g. White Sox vs Red Sox).
function matchOddsGame(og: any, homeName: string, awayName: string): boolean {
  // Priority 1: exact full name match on both sides
  if (og.home_team === homeName && og.away_team === awayName) return true;
  // Priority 2: exact full name match on either side
  if (og.home_team === homeName || og.away_team === awayName) return true;
  // Priority 3: last-word fuzzy match — MUST match BOTH teams
  const homeLast = homeName.split(" ").pop() || "";
  const awayLast = awayName.split(" ").pop() || "";
  const teams = og.bookmakers?.[0]?.markets?.[0]?.outcomes?.map((o: any) => o.name) || [];
  const homeMatch = teams.some((t: string) => t.includes(homeLast) || t === homeName);
  const awayMatch = teams.some((t: string) => t.includes(awayLast) || t === awayName);
  return homeMatch && awayMatch;
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
        .where(eq(parlayCards.date, date))
        .limit(1);

      if (existing.length === 0) {
        try {
          // Enrich games with predictions
          // Fetch real event IDs and pull props per game (cap at 10 to save quota)
          const events = await fetchMLBEvents().catch(() => []);
          const propResults = await Promise.all(
            schedule.slice(0, 10).map(async (g: any) => {
              const homeName = g.teams?.home?.team?.name || "";
              const awayName = g.teams?.away?.team?.name || "";
              const event = events.find((e: any) =>
                e.home_team === homeName || e.away_team === awayName ||
                e.home_team?.includes(homeName.split(" ").pop() || "") ||
                e.away_team?.includes(awayName.split(" ").pop() || "")
              );
              if (!event?.id) return null;
              return fetchMLBPlayerProps(event.id).catch(() => null);
            })
          );
          const rawProps = propResults.filter(Boolean);
          const enriched: any[] = [];
          // Fetch bullpen, lineup, and pitcher form data for all games (same as getTodaysGames)
          const bullpenMap = new Map<number, any>();
          const lineupMap = new Map<number, any>();
          const recentFormMap = new Map<number, any>();
          const teamIds = new Set<number>();
          const pitcherIds = new Set<number>();
          for (const g of schedule) {
            const hId = g.teams?.home?.team?.id;
            const aId = g.teams?.away?.team?.id;
            const hPId = g.teams?.home?.probablePitcher?.id;
            const aPId = g.teams?.away?.probablePitcher?.id;
            if (hId) teamIds.add(hId);
            if (aId) teamIds.add(aId);
            if (hPId) pitcherIds.add(hPId);
            if (aPId) pitcherIds.add(aPId);
          }
          await Promise.all([
            ...Array.from(teamIds).map(async id => {
              const s = await fetchBullpenStatus(id).catch(() => null);
              if (s) bullpenMap.set(id, s);
            }),
            ...Array.from(pitcherIds).map(async id => {
              const f = await fetchPitcherRecentForm(id, "").catch(() => null);
              if (f) recentFormMap.set(id, f);
            }),
            ...schedule.map(async (g: any) => {
              const lineup = await fetchConfirmedLineups(g.gamePk).catch(() => null);
              if (lineup) lineupMap.set(g.gamePk, lineup);
            }),
          ]);

          for (const game of schedule) {
            const homeTeamId = game.teams?.home?.team?.id;
            const awayTeamId = game.teams?.away?.team?.id;
            const stadiumInfo = (STADIUM_DATA as any)[homeTeamId];
            let weather: any = null;
            if (stadiumInfo) {
              weather = await fetchGameWeather(
                game.gamePk, stadiumInfo.lat, stadiumInfo.lon,
                stadiumInfo.altFt, process.env.OPENWEATHER_API_KEY
              ).catch(() => null);
            }
            // Use canonical matchOddsGame (both-team matching, no Sox/Sox collision)
            const homeName = game.teams?.home?.team?.name || "";
            const awayName = game.teams?.away?.team?.name || "";
            const oddsGame = (Array.isArray(oddsData) ? oddsData : []).find(
              (o: any) => matchOddsGame(o, homeName, awayName)
            );
            // Use canonical buildGameFeaturesSync — no hardcoded fallbacks
            const features = buildGameFeaturesSync(
              game, oddsGame,
              null, null, null, null,
              weather,
              bullpenMap.get(homeTeamId),
              bullpenMap.get(awayTeamId),
              lineupMap.get(game.gamePk),
              recentFormMap.get(game.teams?.home?.probablePitcher?.id),
              recentFormMap.get(game.teams?.away?.probablePitcher?.id)
            );
            const analysis = analyzeGame(features);
            enriched.push({
              gamePk: game.gamePk, gameDate: date,
              homeTeam: { id: homeTeamId, name: homeName },
              awayTeam: { id: awayTeamId, name: awayName },
              homePitcher: game.teams?.home?.probablePitcher ? { name: game.teams.home.probablePitcher.fullName, era: null, fip: null } : null,
              awayPitcher: game.teams?.away?.probablePitcher ? { name: game.teams.away.probablePitcher.fullName, era: null, fip: null } : null,
              weather, parkFactor: stadiumInfo, predictions: analysis,
            });
          }

          const parlays = generateDailyParlays(enriched, Array.isArray(rawProps) ? rawProps : []);
          const now = Date.now();
          for (const parlay of parlays) {
            const [inserted] = await db.insert(parlayCards).values({
              date: date, type: parlay.type,
              legs: parlay.legs as any, combinedOdds: parlay.combinedOdds,
              totalLegs: parlay.totalLegs, reasoning: parlay.reasoning,
              result: "pending", legsWon: 0, legsLost: 0, generatedAt: now,
            });
            const cardId = (inserted as any).insertId;
            if (!cardId) continue;
            for (const leg of parlay.legs) {
              await db.insert(parlayLegs).values({
                parlayCardId: cardId, gamePk: leg.gamePk,
                gameDate: typeof leg.gameDate === 'string' ? leg.gameDate : new Date(leg.gameDate).toISOString().split('T')[0], homeTeam: leg.homeTeam,
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
