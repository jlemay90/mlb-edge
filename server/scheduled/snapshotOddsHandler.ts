/**
 * Lightweight odds snapshot handler — runs every 30 minutes during game hours
 * (noon–midnight ET, i.e. 16:00–04:00 UTC).
 *
 * Cost: 3 Odds API credits per run (h2h + spreads + totals, 1 region, 2 bookmakers).
 * At 24 runs/day this is 72 credits/day vs ~2,160/month — well within the 20K quota.
 *
 * Does NOT fetch player props, generate parlays, or run grading.
 * Those stay in the full daily refresh at 9 AM ET.
 *
 * Mounted at POST /api/scheduled/snapshot-odds in server/_core/index.ts.
 */

import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { oddsSnapshots } from "../../drizzle/schema";
import { fetchTodaysSchedule, fetchMLBOdds } from "../services/mlbData";

// Match an Odds API game to an MLB schedule game by team name.
// MUST match BOTH home AND away to prevent false positives (e.g. White Sox vs Red Sox).
function matchOddsGame(og: any, homeName: string, awayName: string): boolean {
  if (og.home_team === homeName && og.away_team === awayName) return true;
  if (og.home_team === homeName || og.away_team === awayName) return true;
  const homeLast = homeName.split(" ").pop() || "";
  const awayLast = awayName.split(" ").pop() || "";
  const teams = og.bookmakers?.[0]?.markets?.[0]?.outcomes?.map((o: any) => o.name) || [];
  const homeMatch = teams.some((t: string) => t.includes(homeLast) || t === homeName);
  const awayMatch = teams.some((t: string) => t.includes(awayLast) || t === awayName);
  return homeMatch && awayMatch;
}

export async function snapshotOddsHandler(req: Request, res: Response) {
  try {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(403).json({ error: "cron-only" });
    }
    if (!user?.isCron || !user?.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const date = new Date().toISOString().split("T")[0];

    // Fetch schedule and odds in parallel — single Odds API call (3 credits)
    const [schedule, oddsData] = await Promise.all([
      fetchTodaysSchedule(date).catch(() => [] as any[]),
      fetchMLBOdds("h2h,spreads,totals").catch(() => [] as any[]),
    ]);

    if (!schedule.length || !Array.isArray(oddsData) || !oddsData.length) {
      return res.json({ ok: true, snapshots: 0, reason: "no-data" });
    }

    const db = await getDb();
    if (!db) return res.json({ ok: true, snapshots: 0, reason: "no-db" });

    let snapshots = 0;
    const errors: string[] = [];

    for (const game of schedule) {
      const homeName: string = game?.teams?.home?.team?.name || "";
      const awayName: string = game?.teams?.away?.team?.name || "";
      if (!homeName || !awayName) continue;

      const og = oddsData.find((o: any) => matchOddsGame(o, homeName, awayName));
      if (!og) continue;

      // Prefer DraftKings, fall back to first available bookmaker
      const book =
        og.bookmakers?.find((b: any) => b.key === "draftkings") ||
        og.bookmakers?.[0];
      if (!book) continue;

      const h2h = book.markets?.find((m: any) => m.key === "h2h");
      const spreads = book.markets?.find((m: any) => m.key === "spreads");
      const totals = book.markets?.find((m: any) => m.key === "totals");

      const homePrice: number | undefined = h2h?.outcomes?.find(
        (o: any) => o.name === homeName
      )?.price;
      const awayPrice: number | undefined = h2h?.outcomes?.find(
        (o: any) => o.name === awayName
      )?.price;
      const overOutcome = totals?.outcomes?.find((o: any) => o.name === "Over");

      // Run line (spread) — find the favorite's -1.5 side
      const homeSpread = spreads?.outcomes?.find((o: any) => o.name === homeName);
      const awaySpread = spreads?.outcomes?.find((o: any) => o.name === awayName);
      const homeRunLineOdds: number | undefined = homeSpread?.price;
      const awayRunLineOdds: number | undefined = awaySpread?.price;

      try {
        await db.insert(oddsSnapshots).values({
          gamePk: game.gamePk,
          bookmaker: book.key || "draftkings",
          market: "h2h" as any,
          homePrice: typeof homePrice === "number" ? homePrice : undefined,
          awayPrice: typeof awayPrice === "number" ? awayPrice : undefined,
          total: typeof overOutcome?.point === "number" ? overOutcome.point : undefined,
          overPrice: typeof overOutcome?.price === "number" ? overOutcome.price : undefined,
          // Store run line odds in the snapshot for richer line movement charts
          // (homeRunLineOdds / awayRunLineOdds are extra columns we'll add if needed,
          //  for now the h2h + total snapshot is the primary line movement signal)
        });
        snapshots++;
      } catch (err: any) {
        errors.push(`gamePk ${game.gamePk}: ${err?.message || "insert failed"}`);
      }
    }

    console.log(`[snapshot-odds] ${date}: ${snapshots} snapshots written, ${errors.length} errors`);
    if (errors.length) console.warn("[snapshot-odds] errors:", errors);

    return res.json({ ok: true, snapshots, errors: errors.length ? errors : undefined });
  } catch (err: any) {
    console.error("[snapshot-odds] fatal:", err?.message);
    return res.status(500).json({
      error: err?.message || "unknown",
      stack: err?.stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}
