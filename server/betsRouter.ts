/**
 * Bets router — Syndicate-tier bankroll/bet tracker + referral stats.
 *
 * All money is handled in cents. The bet tracker is gated to Syndicate (or owner)
 * because it is a Syndicate-tier feature; the referral stats are available to any
 * logged-in user.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import {
  getSubscriptionByOpenId,
  insertUserBet,
  listUserBets,
  settleUserBet,
  deleteUserBet,
  getBetSummary,
  getReferralCount,
} from "./db";

/** Resolve the caller's effective tier, treating owner/admin as syndicate. */
async function resolveTier(ctx: any): Promise<string> {
  const isOwner =
    ctx.user.openId === process.env.OWNER_OPEN_ID || ctx.user.role === "admin";
  if (isOwner) return "syndicate";
  const sub = await getSubscriptionByOpenId(ctx.user.openId, {
    name: ctx.user.name,
    email: ctx.user.email ?? null,
    loginMethod: ctx.user.loginMethod ?? null,
  });
  // Only grant feature access while the subscription is in good standing.
  const ok = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
  return ok ? sub.tier : "free";
}

async function requireSyndicate(ctx: any) {
  const tier = await resolveTier(ctx);
  if (tier !== "syndicate") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "The bankroll tracker is a Syndicate feature.",
    });
  }
}

export const betsRouter = router({
  // List the caller's bets + aggregate bankroll summary.
  list: protectedProcedure.query(async ({ ctx }) => {
    await requireSyndicate(ctx);
    const [bets, summary] = await Promise.all([
      listUserBets(ctx.user.id),
      getBetSummary(ctx.user.id),
    ]);
    return { bets, summary };
  }),

  // Log a new bet. Stake is provided in dollars and converted to cents here.
  add: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1).max(300),
        betType: z.enum(["moneyline", "runline", "total", "prop", "parlay", "other"]).default("other"),
        odds: z.number().int().min(-100000).max(100000),
        stakeDollars: z.number().min(0.01).max(1000000),
        parlayCardId: z.number().int().optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireSyndicate(ctx);
      // Guard against the invalid 0 / -0 American-odds value.
      if (input.odds === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Odds cannot be 0. Use e.g. -110 or +145." });
      }
      const id = await insertUserBet({
        userId: ctx.user.id,
        description: input.description,
        betType: input.betType,
        odds: input.odds,
        stakeCents: Math.round(input.stakeDollars * 100),
        parlayCardId: input.parlayCardId ?? null,
        result: "pending",
        payoutCents: null,
        placedAt: Date.now(),
        settledAt: null,
        notes: input.notes ?? null,
      });
      return { id };
    }),

  // Settle a bet (win/loss/push/void). Payout is computed server-side.
  settle: protectedProcedure
    .input(
      z.object({
        betId: z.number().int(),
        result: z.enum(["win", "loss", "push", "void"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireSyndicate(ctx);
      const ok = await settleUserBet(ctx.user.id, input.betId, input.result);
      if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Bet not found." });
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ betId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await requireSyndicate(ctx);
      await deleteUserBet(ctx.user.id, input.betId);
      return { ok: true };
    }),

  // Referral stats for any logged-in user (not gated).
  myReferralStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await getReferralCount(ctx.user.id);
    return { successfulReferrals: count };
  }),
});
