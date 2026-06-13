import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { getDb, claimFoundingMember } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

type SubscriptionTier = "free" | "pro" | "sharp" | "syndicate";

function tierFromMetadata(metadata: Record<string, string>): SubscriptionTier {
  const tier = metadata?.tier as SubscriptionTier;
  if (tier === "pro" || tier === "sharp" || tier === "syndicate") return tier;
  return "free";
}

export function registerStripeWebhook(app: Express) {
  // MUST use express.raw() for webhook signature verification
  app.post(
    "/api/stripe/webhook",
    // express.raw is applied per-route here
    (req: Request, res: Response, next) => {
      // If body is already a Buffer (raw), proceed; otherwise parse it
      if (Buffer.isBuffer(req.body)) return next();
      let data = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => { data += chunk; });
      req.on("end", () => {
        (req as any).rawBody = data;
        next();
      });
    },
    async (req: Request, res: Response) => {
      const stripe = getStripe();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const sig = req.headers["stripe-signature"];

      let event: Stripe.Event;

      try {
        const body = Buffer.isBuffer(req.body) ? req.body : (req as any).rawBody || "";
        if (!webhookSecret || !sig) {
          // No webhook secret configured — parse body directly (dev mode)
          event = typeof body === "string" ? JSON.parse(body) : req.body;
        } else {
          event = stripe.webhooks.constructEvent(body, sig as string, webhookSecret);
        }
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      // Handle test events
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      console.log(`[Stripe Webhook] Event: ${event.type} (${event.id})`);

      const db = await getDb();
      if (!db) {
        console.error("[Stripe Webhook] Database unavailable");
        return res.status(500).json({ error: "Database unavailable" });
      }

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = parseInt(session.metadata?.user_id || session.client_reference_id || "0");
            const tier = tierFromMetadata(session.metadata as Record<string, string>);
            const customerId = session.customer as string;
            const subscriptionId = session.subscription as string;

            if (userId) {
              await db
                .update(users)
                .set({
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: subscriptionId,
                  subscriptionTier: tier,
                  subscriptionStatus: "active",
                } as any)
                .where(eq(users.id, userId));
              console.log(`[Stripe Webhook] User ${userId} upgraded to ${tier}`);

              // Founding-500: lock the rate for life by flagging the user now
              // that payment is confirmed. claimFoundingMember is cap-safe.
              try {
                const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
                if (u?.openId) {
                  const num = await claimFoundingMember(u.openId);
                  if (num) console.log(`[Stripe Webhook] User ${userId} claimed founding spot #${num}`);
                }
              } catch (e) {
                console.error("[Stripe Webhook] Founding claim failed (non-fatal):", e);
              }
            }
            break;
          }

          case "customer.subscription.created":
          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;
            const tier = tierFromMetadata(subscription.metadata as Record<string, string>);
            const status = subscription.status;
            // Statuses that should grant access. "trialing" is critical —
            // a 7-day free trial reports "trialing", NOT "active".
            const grantsAccess = status === "active" || status === "trialing";
            // Derive the trial/period end so the UI can show "renews on".
            const periodEndUnix =
              (subscription as any).items?.data?.[0]?.current_period_end ??
              (subscription as any).current_period_end ??
              null;
            const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;

            await db
              .update(users)
              .set({
                subscriptionTier: grantsAccess ? tier : "free",
                subscriptionStatus: status,
                stripeSubscriptionId: subscription.id,
                subscriptionPeriodEnd: periodEnd,
              } as any)
              .where(eq((users as any).stripeCustomerId, customerId));
            console.log(`[Stripe Webhook] Subscription ${status} for customer ${customerId} -> ${grantsAccess ? tier : "free"}`);
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;

            await db
              .update(users)
              .set({
                subscriptionTier: "free",
                subscriptionStatus: "canceled",
                stripeSubscriptionId: null,
              } as any)
              .where(eq((users as any).stripeCustomerId, customerId));
            console.log(`[Stripe Webhook] Subscription canceled for customer ${customerId}`);
            break;
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            const customerId = invoice.customer as string;

            await db
              .update(users)
              .set({ subscriptionStatus: "past_due" } as any)
              .where(eq((users as any).stripeCustomerId, customerId));
            console.log(`[Stripe Webhook] Payment failed for customer ${customerId}`);
            break;
          }

          // Refund: downgrade user to free unless they have a founder (lifetime) tier.
          // A refunded subscription means they no longer paid — revoke access.
          case "charge.refunded": {
            const charge = event.data.object as Stripe.Charge;
            const customerId = charge.customer as string;
            if (!customerId) break;

            // Look up the user by Stripe customer ID
            const [refundedUser] = await db
              .select()
              .from(users)
              .where(eq((users as any).stripeCustomerId, customerId))
              .limit(1);

            if (!refundedUser) {
              console.log(`[Stripe Webhook] Refund: no user found for customer ${customerId}`);
              break;
            }

            const currentTier = (refundedUser as any).subscriptionTier as string;

            // Founder is a one-time lifetime purchase — only downgrade if
            // the refund amount equals the full founder price ($50 = 5000 cents).
            // For subscriptions, always downgrade.
            const isFounderRefund =
              currentTier === "founder" && charge.amount_refunded >= 5000;

            if (currentTier !== "founder" || isFounderRefund) {
              await db
                .update(users)
                .set({
                  subscriptionTier: "free",
                  subscriptionStatus: "canceled",
                  stripeSubscriptionId: null,
                } as any)
                .where(eq((users as any).stripeCustomerId, customerId));
              console.log(
                `[Stripe Webhook] Refund processed — user ${(refundedUser as any).id} downgraded to free`
              );
            } else {
              console.log(
                `[Stripe Webhook] Partial refund on founder tier — access retained for user ${(refundedUser as any).id}`
              );
            }
            break;
          }

          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }
      } catch (err) {
        console.error("[Stripe Webhook] Error processing event:", err);
        return res.status(500).json({ error: "Internal error processing webhook" });
      }

      return res.json({ received: true });
    }
  );
}
