/**
 * MLB Edge — Parlay Router
 * tRPC procedures for Parlays of the Day (Sharp tier)
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { parlayCards, parlayLegs, parlayModelFeedback } from "../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { cached, TTL, invalidate } from "./services/cache";
import {
  generateDailyParlays,
  combineParlayOdds,
  analyzeLoss,
  type ParlayType,
  type ParlayLegInput,
} from "./services/parlayEngine";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const parlayRouter = router({

  /**
   * Get today's parlays (all 5 types).
   * If none exist yet, triggers generation as a fallback.
   * Cached for 5 minutes to avoid hammering the DB.
   */
  getToday: publicProcedure.query(async () => {
    const today = todayDateStr();
    return cached(`parlays:today:${today}`, TTL.picks, async () => {
      const db = await getDb();
      if (!db) return { cards: [], generatedAt: null, date: today };

      const cards = await db
        .select()
        .from(parlayCards)
        .where(eq(parlayCards.date, today))
        .orderBy(parlayCards.id);

      // Don't cache empty results — let next call try again
      if (cards.length === 0) {
        invalidate(`parlays:today:${today}`);
        return { cards: [], generatedAt: null, date: today };
      }

      // Attach legs to each card
      const cardIds = cards.map((c) => c.id);
      const legs = await db
        .select()
        .from(parlayLegs)
        .where(inArray(parlayLegs.parlayCardId, cardIds));

      const legsMap: Record<number, typeof legs> = {};
      for (const leg of legs) {
        if (!legsMap[leg.parlayCardId]) legsMap[leg.parlayCardId] = [];
        legsMap[leg.parlayCardId].push(leg);
      }

      const result = cards.map((c) => ({
        ...c,
        dbLegs: legsMap[c.id] ?? [],
      }));

      return {
        cards: result,
        generatedAt: cards[0]?.generatedAt ?? null,
        date: today,
      };
    });
  }),

  /**
   * Generate today's parlays from live game data.
   * Idempotent — if parlays already exist for today, returns them.
   * Called by the cron job and as a page-load fallback.
   */
  generate: publicProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .mutation(async ({ input }) => {
      const today = todayDateStr();
      const db = await getDb();
      if (!db) return { generated: false, reason: "db_unavailable" };

      // Check if already generated today
      if (!input?.force) {
        const existing = await db
          .select({ id: parlayCards.id })
          .from(parlayCards)
          .where(eq(parlayCards.date, today))
          .limit(1);
        if (existing.length > 0) {
          // Bust cache so getToday picks up the existing records
          invalidate(`parlays:today:${today}`);
          return { generated: false, reason: "already_exists" };
        }
      } else {
        // Force regenerate — delete today's cards and legs
        const existing = await db
          .select({ id: parlayCards.id })
          .from(parlayCards)
          .where(eq(parlayCards.date, today));
        if (existing.length > 0) {
          const ids = existing.map((c) => c.id);
          await db.delete(parlayLegs).where(inArray(parlayLegs.parlayCardId, ids));
          await db.delete(parlayCards).where(eq(parlayCards.date, today));
        }
      }

      // Fetch live game data via the cached mlbRouter helpers
      const { fetchMLBPlayerProps, fetchMLBEvents } = await import("./services/mlbData");
      // Use the same cache key as mlbRouter.getTodaysGames — avoids redundant API calls
      // and ensures we use the correctly enriched game objects with proper field names
      const enrichedGames: any[] = await cached(`todaysGames:${today}`, TTL.picks, async () => {
        // Cache is cold — fetch fresh using the same logic as mlbRouter
        const { fetchTodaysSchedule: fts, fetchMLBOdds: fmo, fetchGameWeather: fgw } = await import("./services/mlbData");
        const { analyzeGame: ag } = await import("./services/predictionEngine");
        // buildGameFeaturesSync lives in mlbRouter (not mlbData) — import it directly
        const { buildGameFeaturesSync: bgfs } = await import("./mlbRouter");
        const sched = await fts(today).catch(() => []);
        const oddsArr = await fmo("h2h,spreads,totals").catch(() => []);
        const results: any[] = [];
        for (const game of sched) {
          const homeTeamId = game.teams?.home?.team?.id;
          let weather: any = null;
          // buildGameFeaturesSync uses STADIUM_DATA internally from mlbRouter
          const oddsGame = oddsArr.find((o: any) => {
            if (o.home_team === game.teams?.home?.team?.name) return true;
            const homeLast = (game.teams?.home?.team?.name || "").split(" ").pop() || "";
            const teams = o.bookmakers?.[0]?.markets?.[0]?.outcomes?.map((x: any) => x.name) || [];
            return teams.some((t: string) => t.includes(homeLast));
          });
          // Fetch weather for this game
          const { STADIUM_DATA: SD } = await import("./services/mlbData");
          const stadiumInfo = (SD as any)[homeTeamId];
          if (stadiumInfo) {
            weather = await fgw(game.gamePk, stadiumInfo.lat, stadiumInfo.lon, stadiumInfo.altFt, process.env.OPENWEATHER_API_KEY).catch(() => null);
          }
          // Use canonical buildGameFeaturesSync — correct field names for analyzeGame
          const features = bgfs(game, oddsGame, null, null, null, null, weather);
          const analysis = ag(features);
          results.push({
            gamePk: game.gamePk,
            gameDate: today,
            homeTeam: { id: homeTeamId, name: game.teams?.home?.team?.name },
            awayTeam: { id: game.teams?.away?.team?.id, name: game.teams?.away?.team?.name },
            homePitcher: game.teams?.home?.probablePitcher ? { name: game.teams.home.probablePitcher.fullName, era: null, fip: null } : null,
            awayPitcher: game.teams?.away?.probablePitcher ? { name: game.teams.away.probablePitcher.fullName, era: null, fip: null } : null,
            weather,
            parkFactor: stadiumInfo,
            predictions: analysis,
          });
        }
        return results;
      }) || [];

      const enriched: any[] = enrichedGames || [];

      // Fetch real event IDs from the Odds API, then pull props for each game
      let rawProps: any[] = [];
      try {
        const { fetchMLBEvents } = await import("./services/mlbData");
        const events = await fetchMLBEvents().catch(() => []);
        // For each enriched game, find the matching Odds API event ID
        const propResults = await Promise.all(
          enriched.slice(0, 10).map(async (game: any) => { // cap at 10 to save quota
            const homeName = game.homeTeam?.name || "";
            const awayName = game.awayTeam?.name || "";
            const event = events.find((e: any) =>
              e.home_team === homeName || e.away_team === awayName ||
              e.home_team?.includes(homeName.split(" ").pop() || "") ||
              e.away_team?.includes(awayName.split(" ").pop() || "")
            );
            if (!event?.id) return null;
            const propsData = await fetchMLBPlayerProps(event.id).catch(() => null);
            return propsData;
          })
        );
        rawProps = propResults.filter(Boolean);
      } catch (propErr) {
        console.error("[parlayRouter] Props fetch failed:", (propErr as Error).message);
      }

      if (enriched.length === 0) return { generated: false, reason: "no_games_today" };

      // Generate all 5 parlay types
      const parlays = generateDailyParlays(enriched, rawProps);
      if (parlays.length === 0) return { generated: false, reason: "insufficient_edge" };

      const now = Date.now();
      let savedCount = 0;

      for (const parlay of parlays) {
        // Insert parlay card
        const [inserted] = await db.insert(parlayCards).values({
          date: today,
          type: parlay.type,
          legs: parlay.legs as any,
          combinedOdds: parlay.combinedOdds,
          totalLegs: parlay.totalLegs,
          reasoning: parlay.reasoning,
          result: "pending",
          legsWon: 0,
          legsLost: 0,
          generatedAt: now,
        });

        const cardId = (inserted as any).insertId;
        if (!cardId) continue;

        // Insert individual legs
        for (const leg of parlay.legs) {
          await db.insert(parlayLegs).values({
            parlayCardId: cardId,
            gamePk: leg.gamePk,
            gameDate: typeof leg.gameDate === 'string' ? leg.gameDate : new Date(leg.gameDate).toISOString().split('T')[0],
            homeTeam: leg.homeTeam,
            awayTeam: leg.awayTeam,
            market: leg.market,
            pick: leg.pick,
            pickLabel: leg.pickLabel,
            odds: leg.odds,
            edgeScore: leg.edgeScore,
            modelProbability: leg.modelProbability,
            reasoning: leg.reasoning,
            result: "pending",
          });
        }

        savedCount++;
      }

      // Invalidate cache
      // (cache will auto-expire; next getToday call will re-fetch from DB)

      // Bust cache so getToday immediately returns the new parlays
      invalidate(`parlays:today:${today}`);

      return { generated: true, count: savedCount, date: today };
    }),

  /**
   * Grade legs for a parlay card after games complete.
   * Pass leg results to update win/loss tracking.
   */
  gradeLegs: publicProcedure
    .input(
      z.object({
        parlayCardId: z.number(),
        legResults: z.array(
          z.object({
            legId: z.number(),
            result: z.enum(["win", "loss", "push"]),
            actualOutcome: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { ok: false };

      let won = 0;
      let lost = 0;
      let pushed = 0;

      for (const lr of input.legResults) {
        await db
          .update(parlayLegs)
          .set({
            result: lr.result,
            actualOutcome: lr.actualOutcome ?? null,
          })
          .where(eq(parlayLegs.id, lr.legId));
        if (lr.result === "win") won++;
        else if (lr.result === "loss") lost++;
        else pushed++;
      }

      // Determine parlay result
      const parlayResult: "win" | "loss" | "push" =
        lost > 0 ? "loss" : pushed === input.legResults.length ? "push" : "win";

      await db
        .update(parlayCards)
        .set({
          result: parlayResult,
          legsWon: won,
          legsLost: lost,
          gradedAt: Date.now(),
        })
        .where(eq(parlayCards.id, input.parlayCardId));

      // Auto-generate loss analysis if parlay lost
      if (parlayResult === "loss") {
        const lostLegs = await db
          .select()
          .from(parlayLegs)
          .where(and(eq(parlayLegs.parlayCardId, input.parlayCardId), eq(parlayLegs.result, "loss")));

        const card = await db
          .select()
          .from(parlayCards)
          .where(eq(parlayCards.id, input.parlayCardId))
          .limit(1);

        if (card.length > 0) {
          const analysis = analyzeLoss(
            card[0].type as ParlayType,
            lostLegs.map((l) => ({
              market: l.market,
              pick: l.pick,
              reasoning: l.reasoning ?? "",
              actualOutcome: l.actualOutcome ?? "unknown",
            }))
          );

          await db
            .update(parlayCards)
            .set({ lossAnalysis: analysis.missedReason })
            .where(eq(parlayCards.id, input.parlayCardId));

          // Log feedback for model improvement
          await db.insert(parlayModelFeedback).values({
            date: typeof card[0].date === "string" ? new Date(card[0].date) : card[0].date,
            parlayType: card[0].type as ParlayType,
            marketType: lostLegs[0]?.market ?? "unknown",
            missedReason: analysis.missedReason,
            dataSignals: analysis.dataSignals,
            improvementNote: analysis.improvementNote,
            createdAt: Date.now(),
          });
        }
      }

      return { ok: true, result: parlayResult, won, lost, pushed };
    }),

  /**
   * Get historical parlay log (last 30 days).
   * Returns record tally and per-day breakdown.
   */
  getLogs: publicProcedure
    .input(z.object({ days: z.number().min(1).max(90).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { logs: [], record: { wins: 0, losses: 0, pushes: 0, pending: 0 } };

      const days = input?.days ?? 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      const allCards = await db
        .select()
        .from(parlayCards)
        .orderBy(desc(parlayCards.date));

      // Tally record
      const record = { wins: 0, losses: 0, pushes: 0, pending: 0 };
      for (const c of allCards) {
        if (c.result === "win") record.wins++;
        else if (c.result === "loss") record.losses++;
        else if (c.result === "push") record.pushes++;
        else record.pending++;
      }

      return { logs: allCards, record };
    }),

  /**
   * Get full parlay log with legs for history view.
   */
  getHistory: publicProcedure
    .input(z.object({ days: z.number().min(1).max(90).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { days: [], record: { wins: 0, losses: 0, pushes: 0, pending: 0 }, totalParlays: 0 };

      const days = input?.days ?? 14;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      // Get all cards in range
      const allCards = await db
        .select()
        .from(parlayCards)
        .orderBy(desc(parlayCards.date), parlayCards.type);

      const filtered = allCards.filter((c) => {
        const d = typeof c.date === "string" ? c.date : (c.date as Date).toISOString().split("T")[0];
        return d >= cutoffStr;
      });
      if (filtered.length === 0) return { days: [], record: { wins: 0, losses: 0, pushes: 0, pending: 0 }, totalParlays: 0 };

      const cardIds = filtered.map((c) => c.id);
      const legs = await db
        .select()
        .from(parlayLegs)
        .where(inArray(parlayLegs.parlayCardId, cardIds));

      const legsMap: Record<number, typeof legs> = {};
      for (const leg of legs) {
        if (!legsMap[leg.parlayCardId]) legsMap[leg.parlayCardId] = [];
        legsMap[leg.parlayCardId].push(leg);
      }

      // Group by date
      const byDate: Record<string, any[]> = {};
      for (const card of filtered) {
        const dateKey = typeof card.date === "string" ? card.date : (card.date as Date).toISOString().split("T")[0];
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push({ ...card, dbLegs: legsMap[card.id] ?? [] });
      }

      const record = { wins: 0, losses: 0, pushes: 0, pending: 0 };
      for (const c of filtered) {
        if (c.result === "win") record.wins++;
        else if (c.result === "loss") record.losses++;
        else if (c.result === "push") record.pushes++;
        else record.pending++;
      }

      const daysArr = Object.entries(byDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, cards]) => ({ date, cards }));

      return { days: daysArr, record, totalParlays: filtered.length };
    }),

  /**
   * Get model feedback log for self-improvement tracking.
   */
  getFeedback: publicProcedure
    .input(z.object({ days: z.number().min(1).max(90).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const days = input?.days ?? 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      const feedback = await db
        .select()
        .from(parlayModelFeedback)
        .orderBy(desc(parlayModelFeedback.date));

      return feedback.filter((f) => {
        const d = typeof f.date === "string" ? f.date : (f.date as Date).toISOString().split("T")[0];
        return d >= cutoffStr;
      });
    }),
});
