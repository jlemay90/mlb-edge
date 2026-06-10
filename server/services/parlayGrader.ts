/**
 * MLB Edge — Parlay Auto-Grader
 *
 * Fetches final MLB scores for a given date, grades each pending parlay leg
 * (moneyline / run line / total / prop), updates the DB, then calls the LLM
 * to generate a post-game debrief per card.
 *
 * Called from the nightly heartbeat handler after games finish.
 */

import axios from "axios";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { parlayCards, parlayLegs, parlayModelFeedback } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { ParlayType } from "./parlayEngine";

const MLB_API = "https://statsapi.mlb.com/api/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinalGame {
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string; // "Final" | "Postponed" | etc.
  totalRuns: number;
}

// ─── Fetch Final Scores ───────────────────────────────────────────────────────

export async function fetchFinalScores(date: string): Promise<FinalGame[]> {
  const res = await axios.get(`${MLB_API}/schedule`, {
    params: {
      sportId: 1,
      date,
      hydrate: "linescore",
    },
    timeout: 10000,
  });

  const games = res.data?.dates?.[0]?.games ?? [];
  const results: FinalGame[] = [];

  for (const g of games) {
    const state = g.status?.abstractGameState;
    if (state !== "Final") continue; // Skip in-progress or postponed

    const homeScore = g.teams?.home?.score ?? 0;
    const awayScore = g.teams?.away?.score ?? 0;

    results.push({
      gamePk: g.gamePk,
      homeTeam: g.teams?.home?.team?.name ?? "",
      awayTeam: g.teams?.away?.team?.name ?? "",
      homeScore,
      awayScore,
      status: g.status?.detailedState ?? "Final",
      totalRuns: homeScore + awayScore,
    });
  }

  return results;
}

// ─── Grade a Single Leg ───────────────────────────────────────────────────────

function gradeLeg(
  leg: { market: string; pick: string; pickLabel: string | null },
  game: FinalGame
): { result: "win" | "loss" | "push"; actualOutcome: string } {
  const { homeScore, awayScore, homeTeam, awayTeam, totalRuns } = game;
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  const pick = leg.pick.toLowerCase();
  const label = (leg.pickLabel ?? "").toLowerCase();

  const actualOutcome = `${awayTeam} ${awayScore}, ${homeTeam} ${homeScore} (total: ${totalRuns})`;

  switch (leg.market) {
    case "moneyline": {
      // pick is "home" or "away" or a team name
      let pickedHome: boolean;
      if (pick === "home") {
        pickedHome = true;
      } else if (pick === "away") {
        pickedHome = false;
      } else {
        // pick is a team name — check if it matches home or away
        pickedHome = homeTeam.toLowerCase().includes(pick) || pick.includes(homeTeam.toLowerCase().split(" ").pop() ?? "");
      }

      if (homeScore === awayScore) return { result: "push", actualOutcome };
      const won = pickedHome ? homeWon : awayWon;
      return { result: won ? "win" : "loss", actualOutcome };
    }

    case "runline": {
      // Run line is always ±1.5. Favorite covers -1.5 if they win by 2+.
      // pick label contains the team name and spread e.g. "Atlanta Braves -1.5"
      const isFavorite = label.includes("-1.5");
      let pickedHome: boolean;
      if (pick === "home" || label.includes(homeTeam.toLowerCase().split(" ").pop() ?? "NOPE")) {
        pickedHome = true;
      } else {
        pickedHome = false;
      }

      const margin = homeScore - awayScore; // positive = home won by margin
      if (pickedHome && isFavorite) {
        // Home team -1.5: need to win by 2+
        if (margin >= 2) return { result: "win", actualOutcome };
        if (margin === 1) return { result: "loss", actualOutcome };
        return { result: "loss", actualOutcome };
      } else if (pickedHome && !isFavorite) {
        // Home team +1.5: covers if they win OR lose by exactly 1
        if (margin >= -1) return { result: "win", actualOutcome };
        return { result: "loss", actualOutcome };
      } else if (!pickedHome && isFavorite) {
        // Away team -1.5: need to win by 2+
        const awayMargin = awayScore - homeScore;
        if (awayMargin >= 2) return { result: "win", actualOutcome };
        return { result: "loss", actualOutcome };
      } else {
        // Away team +1.5: covers if they win OR lose by exactly 1
        const awayMargin = awayScore - homeScore;
        if (awayMargin >= -1) return { result: "win", actualOutcome };
        return { result: "loss", actualOutcome };
      }
    }

    case "total": {
      // pick is "over" or "under", label contains the line e.g. "Over 8.5 (-110)"
      const lineMatch = label.match(/(\d+\.?\d*)/);
      const line = lineMatch ? parseFloat(lineMatch[1]) : null;

      if (line === null) return { result: "push", actualOutcome };
      if (totalRuns === line) return { result: "push", actualOutcome };

      const isOver = pick === "over" || label.startsWith("over");
      const won = isOver ? totalRuns > line : totalRuns < line;
      return { result: won ? "win" : "loss", actualOutcome };
    }

    case "prop": {
      // Props can't be auto-graded without player-level box score data.
      // Mark as push (no action) to avoid penalizing the parlay for unavailable data.
      return { result: "push", actualOutcome: "Prop result unavailable — graded as push" };
    }

    default:
      return { result: "push", actualOutcome };
  }
}

// ─── Generate LLM Debrief ─────────────────────────────────────────────────────

async function generateDebrief(
  cardType: string,
  cardReasoning: string,
  legs: Array<{
    pickLabel: string | null;
    market: string;
    reasoning: string | null;
    result: string;
    actualOutcome: string | null;
  }>
): Promise<string> {
  const legSummaries = legs.map((l, i) =>
    `Leg ${i + 1}: ${l.pickLabel ?? l.market} | Result: ${l.result.toUpperCase()} | Actual: ${l.actualOutcome ?? "unknown"} | Original reasoning: ${l.reasoning ?? "none"}`
  ).join("\n");

  const prompt = `You are the analytics engine behind MLB Edge, a professional MLB betting intelligence platform.

A ${cardType.toUpperCase()} parlay card was generated this morning. Here is the post-game debrief request.

ORIGINAL CARD REASONING:
${cardReasoning ?? "No overall reasoning recorded."}

LEG-BY-LEG RESULTS:
${legSummaries}

Write a concise, professional post-game debrief in 3 clearly labeled sections:

**What Happened:** A 2-3 sentence factual summary of how each leg played out and the overall parlay result.

**What the Engine Missed:** A direct, honest assessment of which signals were wrong, overweighted, or absent. Be specific — name the leg, the market, and the likely cause (e.g., bullpen fatigue not captured, line moved after generation, weather shift, pitcher scratch).

**How We Improve:** One or two concrete, actionable changes the model should make going forward based on this result. Be specific and practical, not generic.

Keep the total response under 200 words. Write in a confident, analytical tone — no hedging, no filler.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system" as const, content: "You are a professional sports analytics engine. Be concise, direct, and data-driven." },
        { role: "user" as const, content: prompt },
      ],
    });
    const content = response?.choices?.[0]?.message?.content;
    if (!content) return "Debrief unavailable.";
    return typeof content === "string" ? content : (content as Array<{text?: string}>).map(c => c.text ?? "").join("");
  } catch {
    return "Debrief generation failed — will retry on next run.";
  }
}

// ─── Main Grader ──────────────────────────────────────────────────────────────

export interface GradeResult {
  date: string;
  cardsGraded: number;
  legsGraded: number;
  debriefGenerated: number;
  errors: string[];
}

export async function gradePendingParlays(date: string): Promise<GradeResult> {
  const result: GradeResult = { date, cardsGraded: 0, legsGraded: 0, debriefGenerated: 0, errors: [] };

  const db = await getDb();
  if (!db) {
    result.errors.push("No DB connection");
    return result;
  }

  // 1. Fetch final scores for the date
  let finalGames: FinalGame[];
  try {
    finalGames = await fetchFinalScores(date);
  } catch (e: any) {
    result.errors.push(`fetchFinalScores failed: ${e.message}`);
    return result;
  }

  if (finalGames.length === 0) {
    result.errors.push(`No final games found for ${date}`);
    return result;
  }

  // Build a lookup by gamePk
  const gamesByPk = new Map<number, FinalGame>();
  for (const g of finalGames) gamesByPk.set(g.gamePk, g);

  // 2. Find all pending parlay cards for this date
  const pendingCards = await db
    .select()
    .from(parlayCards)
    .where(and(eq(parlayCards.date, date), eq(parlayCards.result, "pending")));

  if (pendingCards.length === 0) {
    result.errors.push(`No pending cards for ${date}`);
    return result;
  }

  const cardIds = pendingCards.map((c) => c.id);
  const allLegs = await db
    .select()
    .from(parlayLegs)
    .where(inArray(parlayLegs.parlayCardId, cardIds));

  // 3. Grade each leg
  for (const leg of allLegs) {
    if (leg.result !== "pending") continue;

    const game = gamesByPk.get(leg.gamePk);
    if (!game) continue; // Game not final yet — skip

    const { result: legResult, actualOutcome } = gradeLeg(
      { market: leg.market, pick: leg.pick, pickLabel: leg.pickLabel },
      game
    );

    await db
      .update(parlayLegs)
      .set({ result: legResult, actualOutcome })
      .where(eq(parlayLegs.id, leg.id));

    result.legsGraded++;
  }

  // 4. Re-fetch legs to compute card-level results
  const gradedLegs = await db
    .select()
    .from(parlayLegs)
    .where(inArray(parlayLegs.parlayCardId, cardIds));

  const legsByCard = new Map<number, typeof gradedLegs>();
  for (const leg of gradedLegs) {
    if (!legsByCard.has(leg.parlayCardId)) legsByCard.set(leg.parlayCardId, []);
    legsByCard.get(leg.parlayCardId)!.push(leg);
  }

  // 5. Update each card and generate debrief
  for (const card of pendingCards) {
    const legs = legsByCard.get(card.id) ?? [];

    // Only grade if ALL legs with real game data have been graded
    const pendingLegs = legs.filter((l) => l.result === "pending");
    const hasAllResults = pendingLegs.length === 0;
    if (!hasAllResults) continue; // Some games not final yet

    const won = legs.filter((l) => l.result === "win").length;
    const lost = legs.filter((l) => l.result === "loss").length;
    const pushed = legs.filter((l) => l.result === "push").length;

    // Parlay wins only if no legs lost (pushes reduce the parlay, not kill it)
    const cardResult: "win" | "loss" | "push" =
      lost > 0 ? "loss" : pushed === legs.length ? "push" : "win";

    // Generate LLM debrief
    let debrief: string | null = null;
    try {
      debrief = await generateDebrief(
        card.type,
        card.reasoning ?? "",
        legs.map((l) => ({
          pickLabel: l.pickLabel,
          market: l.market,
          reasoning: l.reasoning,
          result: l.result ?? "pending",
          actualOutcome: l.actualOutcome,
        }))
      );
      result.debriefGenerated++;
    } catch (e: any) {
      result.errors.push(`Debrief failed for card ${card.id}: ${e.message}`);
    }

    await db
      .update(parlayCards)
      .set({
        result: cardResult,
        legsWon: won,
        legsLost: lost,
        gradedAt: Date.now(),
        postgameDebrief: debrief,
      })
      .where(eq(parlayCards.id, card.id));

    // Log loss analysis for model feedback
    if (cardResult === "loss") {
      const lostLegs = legs.filter((l) => l.result === "loss");
      const marketCounts: Record<string, number> = {};
      lostLegs.forEach((l) => { marketCounts[l.market] = (marketCounts[l.market] ?? 0) + 1; });
      const dominantMarket = Object.entries(marketCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";

      await db.insert(parlayModelFeedback).values({
        date: card.date as any,
        parlayType: card.type as ParlayType,
        marketType: dominantMarket,
        missedReason: lostLegs.map((l) => `${l.market.toUpperCase()} (${l.pick}): ${l.actualOutcome ?? "unknown"}`).join("; "),
        dataSignals: `Lost ${lostLegs.length}/${legs.length} legs. Dominant missed market: ${dominantMarket}.`,
        improvementNote: debrief?.split("**How We Improve:**")?.[1]?.trim() ?? "Review model thresholds.",
        createdAt: Date.now(),
      });
    }

    result.cardsGraded++;
  }

  return result;
}
