import { z } from "zod";
import Stripe from "stripe";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getDb,
  getFoundingMemberCount,
  getFoundingSpotsRemaining,
  ensureReferralCode,
} from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { STRIPE_PRODUCTS, FOUNDING_MEMBER_CAP, FOUNDING_COUNTER_REVEAL_AT, type SubscriptionTier } from "./products";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

// ── Price resolution by lookup_key ──────────────────────────────────────────
// Prices are created by scripts/create-prices.mjs with stable lookup_keys so
// the SAME code resolves the correct price in test (sandbox) and live (prod).
// We cache resolved IDs in-process to avoid an API call on every checkout.
const _priceCache = new Map<string, string>();

async function resolvePriceId(stripe: Stripe, lookupKey: string): Promise<string> {
  if (!lookupKey) throw new Error("Missing lookup_key for tier");
  const cached = _priceCache.get(lookupKey);
  if (cached) return cached;
  const res = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const price = res.data[0];
  if (!price) {
    throw new Error(
      `No active Stripe price found for lookup_key "${lookupKey}". ` +
        `Run "node scripts/create-prices.mjs" with the current Stripe key to create it.`
    );
  }
  _priceCache.set(lookupKey, price.id);
  return price.id;
}

export const stripeRouter = router({
  // Get current user's subscription status
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { tier: "free" as SubscriptionTier, status: "active", customerId: null };

    const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!user) return { tier: "free" as SubscriptionTier, status: "active", customerId: null };

    const tier = ((user as any).subscriptionTier as SubscriptionTier) || "free";
    const status = (user as any).subscriptionStatus || "active";
    const customerId = (user as any).stripeCustomerId || null;
    const subscriptionId = (user as any).stripeSubscriptionId || null;
    const currentPeriodEnd = (user as any).subscriptionPeriodEnd || null;
    const isFoundingMember = Boolean((user as any).isFoundingMember);
    const foundingMemberNumber = (user as any).foundingMemberNumber || null;

    return {
      tier,
      status,
      customerId,
      subscriptionId,
      currentPeriodEnd,
      isFoundingMember,
      foundingMemberNumber,
    };
  }),

  // Create a Stripe Checkout session for a subscription.
  // No trials, no intro pricing — clean recurring subscription at the listed rate.
  createCheckout: protectedProcedure
    .input(
      z.object({
        tier: z.enum(["pro", "sharp", "syndicate"]),
        billing: z.enum(["monthly", "annual"]).default("monthly"),
        origin: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const tierConfig = STRIPE_PRODUCTS[input.tier];
      const isAnnual = input.billing === "annual";

      const lookupKey = isAnnual ? tierConfig.annualLookupKey : tierConfig.monthlyLookupKey;
      const priceId = await resolvePriceId(stripe, lookupKey);

      // Founding status is informational at checkout time; it is officially
      // claimed in the webhook once payment succeeds. We pass intent through
      // metadata so the webhook can lock the rate.
      const spotsRemaining = await getFoundingSpotsRemaining();
      const foundingEligible = spotsRemaining > 0;

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: ctx.user.email || undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email || "",
          customer_name: ctx.user.name || "",
          tier: input.tier,
          billing: input.billing,
          founding_eligible: foundingEligible ? "1" : "0",
        },
        subscription_data: {
          metadata: {
            user_id: ctx.user.id.toString(),
            tier: input.tier,
            founding_eligible: foundingEligible ? "1" : "0",
          },
        },
        allow_promotion_codes: true,
        success_url: `${input.origin}/billing?success=1&tier=${input.tier}`,
        cancel_url: `${input.origin}/pricing?canceled=1`,
        payment_method_collection: "always",
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      return { url: session.url };
    }),

  // Create a Stripe Billing Portal session for managing subscription
  createPortalSession: protectedProcedure
    .input(z.object({ origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const customerId = (user as any)?.stripeCustomerId;
      if (!customerId) throw new Error("No Stripe customer found. Please subscribe first.");

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${input.origin}/billing`,
      });

      return { url: session.url };
    }),

  // Get available pricing tiers (public). Never exposes internal lookup keys.
  getPricing: publicProcedure.query(() => {
    return Object.values(STRIPE_PRODUCTS).map((tier) => ({
      name: tier.name,
      tier: tier.tier,
      monthlyPrice: tier.monthlyPrice,
      annualPrice: tier.annualPrice,
      annualSavingsLabel: tier.annualSavingsLabel,
      description: tier.description,
      features: tier.features,
      badge: tier.badge,
      highlight: tier.highlight,
    }));
  }),

  // Founding-500 live counter (public, for scarcity badge)
  getFoundingStatus: publicProcedure.query(async () => {
    const claimed = await getFoundingMemberCount();
    const remaining = Math.max(0, FOUNDING_MEMBER_CAP - claimed);
    // Only expose the live count once real momentum exists (see
    // FOUNDING_COUNTER_REVEAL_AT). Below it, the UI shows the offer with no
    // number so an early/zero count never reads as "nobody's here."
    const showCounter = claimed >= FOUNDING_COUNTER_REVEAL_AT;
    return { cap: FOUNDING_MEMBER_CAP, claimed, remaining, soldOut: remaining === 0, showCounter };
  }),

  // Get/generate the logged-in user's referral code + share link
  getMyReferral: protectedProcedure
    .input(z.object({ origin: z.string() }))
    .query(async ({ ctx, input }) => {
      const code = await ensureReferralCode(ctx.user.openId);
      const link = code ? `${input.origin}/?ref=${code}` : null;
      return { code, link };
    }),

  // One-time tip jar payment
  createTipCheckout: protectedProcedure
    .input(
      z.object({
        amount: z.number().int().min(100).max(100000), // cents, $1–$1000
        origin: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        allow_promotion_codes: false,
        customer_email: ctx.user.email || undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email || "",
          customer_name: ctx.user.name || "",
          type: "tip",
          amount_cents: input.amount.toString(),
        },
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "MLB Edge Tip",
                description: "Support the MLB Edge model — thank you!",
              },
              unit_amount: input.amount,
            },
            quantity: 1,
          },
        ],
        success_url: `${input.origin}/billing?tip=success`,
        cancel_url: `${input.origin}/billing`,
      });
      return { url: session.url };
    }),
});
