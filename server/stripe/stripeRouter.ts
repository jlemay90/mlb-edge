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

      // ── Trial + intro pricing model ─────────────────────────────────────────
      // Pro:   $5 upfront for 7-day trial → intro month price ($10) → regular ($29)
      // Sharp: FREE 3-day trial → intro month price ($40) → regular ($79)
      // Annual: skip trial, use annual priceId directly
      const isAnnual = input.billing === "annual";
      const trialDays = input.trialDays ?? (isAnnual ? 0 : (tierConfig.trialDays ?? 7));
      const trialPrice = tierConfig.trialPrice ?? 0; // cents; 0 = free trial

      // Use intro monthly price for first month after trial (monthly only)
      const priceId = isAnnual
        ? tierConfig.annualPriceId
        : (tierConfig.introMonthlyPriceId || tierConfig.monthlyPriceId);

      const priceData = priceId
        ? { price: priceId }
        : {
            price_data: {
              currency: "usd",
              product_data: {
                name: `MLB Edge ${tierConfig.name}`,
                description: tierConfig.description,
                metadata: { tier: input.tier },
              },
              unit_amount: isAnnual ? tierConfig.annualPrice : (tierConfig.introMonthlyPrice ?? tierConfig.monthlyPrice),
              recurring: {
                interval: isAnnual ? ("year" as const) : ("month" as const),
              },
            },
          };

      // Build trial settings
      // For paid trials ($5 Pro), Stripe uses add_invoice_items to charge upfront
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
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
        payment_method_collection: "always",
      };

      if (!isAnnual && trialDays > 0) {
        sessionParams.subscription_data = {
          trial_period_days: trialDays,
          trial_settings: {
            end_behavior: { missing_payment_method: "cancel" },
          },
          metadata: {
            user_id: ctx.user.id.toString(),
            tier: input.tier,
          },
        };
        // For paid trial ($5 Pro): add a one-time invoice item for the trial fee
        if (trialPrice > 0) {
          sessionParams.invoice_creation = {
            enabled: true,
          };
          // Charge trial fee via setup_intent_data + add_invoice_items
          // Stripe doesn't support add_invoice_items in checkout for subscriptions with trials
          // so we use a coupon-based approach: charge full amount, apply discount
          // Simplest approach: use a separate one-time payment line item
          sessionParams.line_items = [
            { ...priceData, quantity: 1 },
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `MLB Edge ${tierConfig.name} — 7-Day Trial Access`,
                  description: "One-time trial fee. Full subscription begins after trial period.",
                },
                unit_amount: trialPrice,
              },
              quantity: 1,
            },
          ];
        }
      } else if (!isAnnual) {
        sessionParams.subscription_data = {
          metadata: {
            user_id: ctx.user.id.toString(),
            tier: input.tier,
          },
        };
      }

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
