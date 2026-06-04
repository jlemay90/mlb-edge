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
  monthlyPrice: number;      // promo monthly price in cents
  monthlyRegPrice?: number;  // regular monthly price in cents (shown crossed out)
  annualPrice: number;       // promo annual price in cents
  annualRegPrice?: number;   // regular annual price in cents (shown crossed out)
  annualSavings?: number;    // savings vs regular annual in cents
  promoMonths?: number;      // how many months the monthly promo applies
  description: string;
  features: string[];
  badge?: string;
}

// Real Stripe price IDs (live mode, created via Stripe MCP on 2026-06-04)
// Products: prod_UdxtmzZagENpyO (Pro), prod_UdxtrkWlQWfnJW (Sharp)
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
    monthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "price_1Tefz1ANxPVrfK4rUjLZ4weG",
    annualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || "price_1TefzAANxPVrfK4rw9FiRiZd",
    // Promo: $19/mo for first 3 months (reg $29/mo), then $29/mo
    // Annual promo: $175/yr first year (reg $348/yr = $29×12), saves $173
    monthlyPrice: 1900,       // $19/mo promo (reg $2900)
    monthlyRegPrice: 2900,    // $29/mo regular
    annualPrice: 17500,       // $175/yr promo (reg $34800)
    annualRegPrice: 34800,    // $348/yr regular
    annualSavings: 17300,     // saves $173 first year
    promoMonths: 3,           // promo applies for 3 months
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
    monthlyPriceId: process.env.STRIPE_SHARP_MONTHLY_PRICE_ID || "price_1TefzMANxPVrfK4rZXCdjRkA",
    annualPriceId: process.env.STRIPE_SHARP_ANNUAL_PRICE_ID || "price_1TefzVANxPVrfK4rfva3m6LR",
    // Promo: $69/mo for first 3 months (reg $79/mo), then $79/mo
    // Annual promo: $500/yr first year (reg $948/yr = $79×12), saves $448
    monthlyPrice: 6900,       // $69/mo promo (reg $7900)
    monthlyRegPrice: 7900,    // $79/mo regular
    annualPrice: 50000,       // $500/yr promo (reg $94800)
    annualRegPrice: 94800,    // $948/yr regular
    annualSavings: 44800,     // saves $448 first year
    promoMonths: 3,           // promo applies for 3 months
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
