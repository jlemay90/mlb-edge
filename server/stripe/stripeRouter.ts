import { z } from "zod";
import Stripe from "stripe";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { STRIPE_PRODUCTS, type SubscriptionTier } from "./products";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
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

    return { tier, status, customerId, subscriptionId, currentPeriodEnd };
  }),

  // Create a Stripe Checkout session for a subscription
  createCheckout: protectedProcedure
    .input(
      z.object({
        tier: z.enum(["pro", "sharp"]),
        billing: z.enum(["monthly", "annual"]).default("monthly"),
        origin: z.string(),
        trialDays: z.number().int().min(0).max(30).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const tierConfig = STRIPE_PRODUCTS[input.tier];
      const priceId =
        input.billing === "annual" ? tierConfig.annualPriceId : tierConfig.monthlyPriceId;

      // Build price_data inline if no price ID is configured yet
      const priceData =
        priceId
          ? { price: priceId }
          : {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `MLB Edge ${tierConfig.name}`,
                  description: tierConfig.description,
                  metadata: { tier: input.tier },
                },
                unit_amount:
                  input.billing === "annual" ? tierConfig.annualPrice : tierConfig.monthlyPrice,
                recurring: {
                  interval: input.billing === "annual" ? ("year" as const) : ("month" as const),
                },
              },
            };

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ ...priceData, quantity: 1 }],
        customer_email: ctx.user.email || undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email || "",
          customer_name: ctx.user.name || "",
          tier: input.tier,
          billing: input.billing,
        },
        allow_promotion_codes: true,
        success_url: `${input.origin}/billing?success=1&tier=${input.tier}`,
        cancel_url: `${input.origin}/pricing?canceled=1`,
        subscription_data: {
          // 7-day free trial by default. A card is collected upfront so Stripe
          // auto-charges at trial end (and emails its own renewal reminder),
          // which minimizes "forgot to cancel" disputes.
          trial_period_days: input.trialDays ?? 7,
          trial_settings: {
            end_behavior: { missing_payment_method: "cancel" },
          },
          metadata: {
            user_id: ctx.user.id.toString(),
            tier: input.tier,
          },
        },
        payment_method_collection: "always",
      });

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

  // Get available pricing tiers (public)
  getPricing: publicProcedure.query(() => {
    return Object.values(STRIPE_PRODUCTS).map((tier) => ({
      ...tier,
      // Don't expose internal price IDs to the client
      monthlyPriceId: undefined,
      annualPriceId: undefined,
    }));
  }),
});
