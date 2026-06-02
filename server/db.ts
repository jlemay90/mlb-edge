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
  tier: "free" | "pro" | "sharp";
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
