// MLB Edge — Stripe Product & Price Configuration
// LIVE mode prices (created 2026-06-04/05)
// Products: prod_Ue6sfnk59m7R8N (Pro), prod_Ue6sAEo82YWmBo (Sharp)
//
// Pricing model:
//   Pro:   $5 for 7-day trial → $10 first month → $29/mo ongoing
//   Sharp: 3-day FREE trial   → $40 first month → $79/mo ongoing  (Limited time)
//   Annual promos remain unchanged

export type SubscriptionTier = "free" | "pro" | "sharp";

export interface TierConfig {
  name: string;
  tier: SubscriptionTier;
  monthlyPriceId: string;       // ongoing monthly price
  annualPriceId: string;
  introMonthlyPriceId?: string; // first-month intro price (after trial)
  trialDays?: number;           // trial length in days
  trialPrice?: number;          // cost of trial in cents (0 = free)
  monthlyPrice: number;         // ongoing monthly price in cents
  monthlyRegPrice?: number;     // regular monthly (shown crossed out)
  introMonthlyPrice?: number;   // first-month price in cents
  annualPrice: number;
  annualRegPrice?: number;
  annualSavings?: number;
  description: string;
  features: string[];
  badge?: string;
  limitedTime?: boolean;        // show "Limited time only" badge
}

export const STRIPE_PRODUCTS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: "Free",
    tier: "free",
    monthlyPriceId: "",
    annualPriceId: "",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Teaser access — upgrade to unlock everything",
    features: [
      "Today's top pick (title only, no analysis)",
      "Basic game schedule",
      "Team standings (no stats)",
    ],
  },
  pro: {
    name: "Pro",
    tier: "pro",
    monthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "price_1TermVANxPVrfK4rVtxXOcVH",
    annualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || "price_1TermWANxPVrfK4r4ePKEkok",
    introMonthlyPriceId: process.env.STRIPE_PRO_INTRO_PRICE_ID || "price_1TermWANxPVrfK4r4ePKEkok",
    trialDays: 7,
    trialPrice: 500,            // $5 for 7-day trial
    introMonthlyPrice: 1000,    // $10 first full month
    monthlyPrice: 2900,         // $29/mo ongoing
    monthlyRegPrice: 2900,
    annualPrice: 17500,         // $175/yr promo
    annualRegPrice: 34800,      // $348/yr regular
    annualSavings: 17300,
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
    monthlyPriceId: process.env.STRIPE_SHARP_MONTHLY_PRICE_ID || "price_1TermXANxPVrfK4rX2pboi1V",
    annualPriceId: process.env.STRIPE_SHARP_ANNUAL_PRICE_ID || "price_1TermXANxPVrfK4rGW0YyKmC",
    introMonthlyPriceId: process.env.STRIPE_SHARP_INTRO_PRICE_ID || "price_1TermXANxPVrfK4rGW0YyKmC",
    trialDays: 3,
    trialPrice: 0,              // FREE 3-day trial
    introMonthlyPrice: 4000,    // $40 first full month
    monthlyPrice: 7900,         // $79/mo ongoing
    monthlyRegPrice: 7900,
    annualPrice: 50000,         // $500/yr promo
    annualRegPrice: 94800,      // $948/yr regular
    annualSavings: 44800,
    description: "Professional-grade edge hunting",
    badge: "For Serious Players",
    limitedTime: true,
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
// Free tier is now a teaser only — almost everything requires Pro+
export const TIER_GATES = {
  allPicks: "pro" as SubscriptionTier,
  pickAnalysis: "pro" as SubscriptionTier,   // rationale/analysis text
  pickOdds: "pro" as SubscriptionTier,        // odds/lines on picks
  playerProps: "pro" as SubscriptionTier,
  lineMovement: "pro" as SubscriptionTier,
  gameDetail: "pro" as SubscriptionTier,
  teamStats: "pro" as SubscriptionTier,       // was free, now pro
  analytics: "pro" as SubscriptionTier,       // was free, now pro
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
