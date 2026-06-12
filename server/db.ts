import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

// ─── Subscription helpers ──────────────────────────────────────────────────

export type SubscriptionInfo = {
  tier: "free" | "pro" | "sharp" | "syndicate";
  status: string | null;
  periodEnd: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

/**
 * Resolve a user's subscription info by openId. Ensures a DB row exists
 * (the OAuth SDK user may not yet be persisted) and defaults to free tier.
 */
export async function getSubscriptionByOpenId(
  openId: string,
  fallback?: { name?: string | null; email?: string | null; loginMethod?: string | null }
): Promise<SubscriptionInfo> {
  const db = await getDb();
  const freeDefault: SubscriptionInfo = {
    tier: "free",
    status: "active",
    periodEnd: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  };
  if (!db) return freeDefault;

  let row = await getUserByOpenId(openId);
  if (!row) {
    // Persist the user so future Stripe webhooks can attach a tier.
    await upsertUser({
      openId,
      name: fallback?.name ?? null,
      email: fallback?.email ?? null,
      loginMethod: fallback?.loginMethod ?? null,
      lastSignedIn: new Date(),
    });
    row = await getUserByOpenId(openId);
  }
  if (!row) return freeDefault;

  return {
    tier: (row.subscriptionTier as SubscriptionInfo["tier"]) ?? "free",
    status: row.subscriptionStatus ?? "active",
    periodEnd: row.subscriptionPeriodEnd ?? null,
    stripeCustomerId: row.stripeCustomerId ?? null,
    stripeSubscriptionId: row.stripeSubscriptionId ?? null,
  };
}

/** Update a user's Stripe customer id (called from checkout/webhook). */
export async function setStripeCustomerId(openId: string, customerId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.openId, openId));
}

// ─── Founding-500 helpers ───────────────────────────────────────────────────
import { and, sql } from "drizzle-orm";
import { FOUNDING_MEMBER_CAP } from "./stripe/products";

/** How many founding spots have been claimed so far. */
export async function getFoundingMemberCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.isFoundingMember, true));
  return Number(rows[0]?.c ?? 0);
}

/** Spots remaining (never below 0). */
export async function getFoundingSpotsRemaining(): Promise<number> {
  const used = await getFoundingMemberCount();
  return Math.max(0, FOUNDING_MEMBER_CAP - used);
}

/**
 * Atomically claim a founding-member spot for a user if any remain and the user
 * is not already a founder. Returns the assigned founding number, or null if
 * the cap is reached. Safe under concurrency via a conditional UPDATE that only
 * fires when the live count is still under the cap.
 */
export async function claimFoundingMember(openId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const existing = await getUserByOpenId(openId);
  if (existing?.isFoundingMember && existing.foundingMemberNumber) {
    return existing.foundingMemberNumber;
  }

  const used = await getFoundingMemberCount();
  if (used >= FOUNDING_MEMBER_CAP) return null;

  const assignedNumber = used + 1;
  // Conditional update: only set founder if still room AND not already a founder.
  await db
    .update(users)
    .set({
      isFoundingMember: true,
      foundingMemberSince: new Date(),
      foundingMemberNumber: assignedNumber,
    })
    .where(and(eq(users.openId, openId), eq(users.isFoundingMember, false)));

  const after = await getUserByOpenId(openId);
  return after?.isFoundingMember ? after.foundingMemberNumber ?? assignedNumber : null;
}

// ─── Referral helpers ────────────────────────────────────────────────────────

/** Generate (and persist) a stable referral code for a user if missing. */
export async function ensureReferralCode(openId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await getUserByOpenId(openId);
  if (!row) return null;
  if (row.referralCode) return row.referralCode;
  // Short, URL-safe, collision-unlikely code derived from id + random.
  const code = `${(row.id ?? 0).toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase().slice(0, 10);
  await db.update(users).set({ referralCode: code }).where(eq(users.openId, openId));
  return code;
}

/** Look up the user who owns a referral code. */
export async function getUserByReferralCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.referralCode, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Bet Tracker helpers (Syndicate bankroll) ───────────────────────────────
import { userBets, type InsertUserBet } from "../drizzle/schema";
import { desc } from "drizzle-orm";

/**
 * Compute total payout (stake + profit) in cents for a winning bet at American odds.
 * +145 on $10 stake → returns 10 + 14.5 = $24.50 ; -110 on $10 → 10 + 9.09 = $19.09.
 * Returns rounded cents.
 */
export function payoutCentsForWin(stakeCents: number, americanOdds: number): number {
  if (americanOdds >= 0) {
    return Math.round(stakeCents + stakeCents * (americanOdds / 100));
  }
  return Math.round(stakeCents + stakeCents * (100 / Math.abs(americanOdds)));
}

export async function insertUserBet(bet: InsertUserBet): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [res] = await db.insert(userBets).values(bet);
  return (res as any).insertId ?? null;
}

export async function listUserBets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userBets)
    .where(eq(userBets.userId, userId))
    .orderBy(desc(userBets.placedAt))
    .limit(500);
}

/** Settle a bet the user owns. Computes payout from stake+odds for wins. */
export async function settleUserBet(
  userId: number,
  betId: number,
  result: "win" | "loss" | "push" | "void"
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(userBets)
    .where(and(eq(userBets.id, betId), eq(userBets.userId, userId)))
    .limit(1);
  const bet = rows[0];
  if (!bet) return false;

  let payoutCents = 0;
  if (result === "win") payoutCents = payoutCentsForWin(bet.stakeCents, bet.odds);
  else if (result === "push" || result === "void") payoutCents = bet.stakeCents; // stake returned
  else payoutCents = 0; // loss

  await db
    .update(userBets)
    .set({ result, payoutCents, settledAt: Date.now() })
    .where(and(eq(userBets.id, betId), eq(userBets.userId, userId)));
  return true;
}

export async function deleteUserBet(userId: number, betId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(userBets).where(and(eq(userBets.id, betId), eq(userBets.userId, userId)));
  return true;
}

/** Aggregate bankroll summary from settled bets. All money in cents. */
export async function getBetSummary(userId: number) {
  const bets = await listUserBets(userId);
  let wins = 0, losses = 0, pushes = 0, voids = 0, pending = 0;
  let stakedCents = 0; // settled, non-void stake (the denominator for ROI)
  let returnedCents = 0; // settled, non-void payout
  for (const b of bets) {
    if (b.result === "pending") { pending++; continue; }
    if (b.result === "void") { voids++; continue; }
    if (b.result === "win") wins++;
    else if (b.result === "loss") losses++;
    else if (b.result === "push") pushes++;
    stakedCents += b.stakeCents;
    returnedCents += b.payoutCents ?? 0;
  }
  const profitCents = returnedCents - stakedCents;
  const settledCount = wins + losses + pushes;
  const roiPct = stakedCents > 0 ? (profitCents / stakedCents) * 100 : null;
  const winPct = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : null;
  return {
    totalBets: bets.length,
    wins, losses, pushes, voids, pending,
    settledCount,
    stakedCents,
    returnedCents,
    profitCents,
    roiPct: roiPct === null ? null : Math.round(roiPct * 10) / 10,
    winPct: winPct === null ? null : Math.round(winPct * 10) / 10,
  };
}

// ─── Referral redemption helpers (leak-safe) ────────────────────────────────
import { referralRedemptions } from "../drizzle/schema";

/**
 * Record that `referredUserId` was referred by `code`/`referrerUserId`.
 * Idempotent: the unique constraint on referred_user_id means a user can only
 * ever be counted once. Returns true if a NEW redemption row was created.
 */
export async function recordReferralRedemption(
  code: string,
  referrerUserId: number,
  referredUserId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  // Don't allow self-referral.
  if (referrerUserId === referredUserId) return false;
  const existing = await db
    .select({ id: referralRedemptions.id })
    .from(referralRedemptions)
    .where(eq(referralRedemptions.referredUserId, referredUserId))
    .limit(1);
  if (existing.length > 0) return false;
  await db.insert(referralRedemptions).values({
    referralCode: code,
    referrerUserId,
    referredUserId,
    rewardGranted: false,
    createdAt: Date.now(),
  });
  return true;
}

/** Count successful referrals a user has made. */
export async function getReferralCount(referrerUserId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(referralRedemptions)
    .where(eq(referralRedemptions.referrerUserId, referrerUserId));
  return Number(rows[0]?.c ?? 0);
}
