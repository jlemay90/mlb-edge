// MLB Edge — Stripe Product & Price Configuration
// These price IDs should be created in your Stripe Dashboard.
// In test mode, use the test price IDs below (prefixed with price_test_).
// In live mode, replace with live price IDs from your Stripe Dashboard.

export type SubscriptionTier = "free" | "pro" | "sharp";

export interface TierConfig {
  name: string;
  tier: SubscriptionTier;
  monthlyPriceId: string;
  annualPriceId: string;
  monthlyPrice: number; // in cents
  annualPrice: number; // in cents
  description: string;
  features: string[];
  badge?: string;
}

// These are placeholder price IDs — replace with real ones from Stripe Dashboard
// after creating products there. The checkout will create them on first use via
// the price data inline approach below.
export const STRIPE_PRODUCTS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: "Free",
    tier: "free",
    monthlyPriceId: "",
    annualPriceId: "",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Get started with basic MLB picks",
    features: [
      "Today's top 3 picks (money line only)",
      "Basic game schedule",
      "Team standings",
      "Limited to 1 game detail per day",
    ],
  },
  pro: {
    name: "Pro",
    tier: "pro",
    monthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
    annualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || "",
    monthlyPrice: 2900, // $29/month
    annualPrice: 24900, // $249/year (~$20.75/mo)
    description: "Full access for serious bettors",
    badge: "Most Popular",
    features: [
      "All picks — money line, run line, totals",
      "Full player props (HR, K, hits, RBI, SB)",
      "Live line movement tracking",
      "Game detail with umpire + weather analysis",
      "Team Stats Explorer (all 30 teams)",
      "Analytics & backtesting dashboard",
      "Real-time odds from 10+ books",
      "Email alerts for A-grade picks",
    ],
  },
  sharp: {
    name: "Sharp",
    tier: "sharp",
    monthlyPriceId: process.env.STRIPE_SHARP_MONTHLY_PRICE_ID || "",
    annualPriceId: process.env.STRIPE_SHARP_ANNUAL_PRICE_ID || "",
    monthlyPrice: 7900, // $79/month
    annualPrice: 69900, // $699/year (~$58.25/mo)
    description: "For professional-grade edge hunting",
    badge: "Best Value",
    features: [
      "Everything in Pro",
      "Parlay builder with correlated picks",
      "Moonshot HR prop analysis (Statcast 420ft+)",
      "Steam move alerts (sharp money signals)",
      "Reverse line movement notifications",
      "Model confidence scores + feature weights",
      "Historical backtesting (50+ years via Retrosheet)",
      "Priority support + Discord access",
    ],
  },
};

// Feature gates — which features require which tier
export const TIER_GATES = {
  allPicks: "pro" as SubscriptionTier,
  playerProps: "pro" as SubscriptionTier,
  lineMovement: "pro" as SubscriptionTier,
  gameDetail: "pro" as SubscriptionTier,
  teamExplorer: "free" as SubscriptionTier,
  analytics: "free" as SubscriptionTier,
  parlayBuilder: "sharp" as SubscriptionTier,
  moonshotProps: "sharp" as SubscriptionTier,
  steamAlerts: "sharp" as SubscriptionTier,
};

export function tierRank(tier: SubscriptionTier): number {
  return { free: 0, pro: 1, sharp: 2 }[tier];
}

export function hasAccess(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return tierRank(userTier) >= tierRank(requiredTier);
}
