// MLB Edge — Stripe Product & Price Configuration
//
// Relaunch pricing (2026-06). Internal tier KEYS are kept stable to avoid a
// large refactor of every feature gate:
//   internal "pro"       -> displayed as "Edge"      $9.99/mo  ($99/yr)
//   internal "sharp"     -> displayed as "Sharp"     $19.99/mo ($199/yr)
//   internal "syndicate" -> displayed as "Syndicate" $49.99/mo ($499/yr)  [NEW]
//
// Prices are resolved at runtime by stable lookup_key (see resolvePriceId in
// stripeRouter.ts), so the SAME code works in test (sandbox) and live
// (production) once `node scripts/create-prices.mjs` has been run in each mode.
//
// Founding-500: the first 500 paying members lock THEIR OWN tier's rate for
// life. We never change a founder's price; new prices only affect new joiners
// after the relaunch rates eventually rise.

export type SubscriptionTier = "free" | "pro" | "sharp" | "syndicate";

export const FOUNDING_MEMBER_CAP = 500;

// Only reveal the live "X of 500 spots left" counter once at least this many
// real founding members have joined. Below the threshold we show the offer
// ("Founding 500 — lock your rate for life") with NO number, so a low/zero
// count never de-motivates early visitors. Truthful by construction: we never
// invent a count — we just withhold it until it reads as momentum.
export const FOUNDING_COUNTER_REVEAL_AT = 25;

export interface TierConfig {
  name: string;            // user-facing label
  tier: SubscriptionTier;  // internal key
  monthlyLookupKey: string;
  annualLookupKey: string;
  monthlyPrice: number;    // cents
  annualPrice: number;     // cents
  annualSavingsLabel?: string;
  description: string;
  features: string[];
  badge?: string;
  highlight?: boolean;     // visually emphasized column
}

export const STRIPE_PRODUCTS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: "Free",
    tier: "free",
    monthlyLookupKey: "",
    annualLookupKey: "",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "One free pick a day — no card required",
    features: [
      "Today's single best pick with full reasoning",
      "Last 14-day public win/loss record",
      "Daily game schedule",
    ],
  },
  pro: {
    name: "Edge",
    tier: "pro",
    monthlyLookupKey: "mlbedge_edge_monthly",
    annualLookupKey: "mlbedge_edge_annual",
    monthlyPrice: 999, // $9.99
    annualPrice: 9900, // $99/yr (~2 months free)
    annualSavingsLabel: "2 months free",
    description: "Every pick, every day — the core edge",
    badge: "Best Value",
    features: [
      "All picks — money line, run line, totals",
      "Full edge % and model reasoning on every pick",
      "Player props (HR, K, hits, RBI, SB)",
      "Live odds from DraftKings + FanDuel",
      "Game detail with umpire + weather + park factors",
      "Team Stats Explorer (all 30 teams)",
    ],
  },
  sharp: {
    name: "Sharp",
    tier: "sharp",
    monthlyLookupKey: "mlbedge_sharp_monthly",
    annualLookupKey: "mlbedge_sharp_annual",
    monthlyPrice: 1999, // $19.99
    annualPrice: 19900, // $199/yr (~2 months free)
    annualSavingsLabel: "2 months free",
    description: "Parlays + props built by the model",
    badge: "Most Popular",
    highlight: true,
    features: [
      "Everything in Edge",
      "5 daily parlays (Power, Value, Lotto, High-Value, HR Prop)",
      "Per-leg reasoning + post-game debriefs",
      "Moonshot HR prop analysis (Statcast-driven)",
      "Line movement + steam / reverse-line alerts",
      "Self-grading W/L history on every parlay",
    ],
  },
  syndicate: {
    name: "Syndicate",
    tier: "syndicate",
    monthlyLookupKey: "mlbedge_syndicate_monthly",
    annualLookupKey: "mlbedge_syndicate_annual",
    monthlyPrice: 4999, // $49.99
    annualPrice: 49900, // $499/yr (~2 months free)
    annualSavingsLabel: "2 months free",
    description: "Everything in Sharp, plus the raw model and bankroll tools",
    badge: "Inner Circle",
    features: [
      "Everything in Sharp",
      "Full model-confidence view — raw edge % on every leg",
      "Bankroll & bet tracker (log bets, track live ROI)",
      "Priority support",
    ],
  },
};

// Feature gates — which features require which tier (by rank).
export const TIER_GATES = {
  allPicks: "pro" as SubscriptionTier,
  pickAnalysis: "pro" as SubscriptionTier,
  pickOdds: "pro" as SubscriptionTier,
  playerProps: "pro" as SubscriptionTier,
  lineMovement: "pro" as SubscriptionTier,
  gameDetail: "pro" as SubscriptionTier,
  teamStats: "pro" as SubscriptionTier,
  analytics: "pro" as SubscriptionTier,
  parlayBuilder: "sharp" as SubscriptionTier,
  moonshotProps: "sharp" as SubscriptionTier,
  steamAlerts: "sharp" as SubscriptionTier,
  // Syndicate-only
  bankrollTracker: "syndicate" as SubscriptionTier,
  rawEdge: "syndicate" as SubscriptionTier,
  earlyAccess: "syndicate" as SubscriptionTier,
};

const RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, sharp: 2, syndicate: 3 };

export function tierRank(tier: SubscriptionTier): number {
  return RANK[tier] ?? 0;
}

export function hasAccess(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return tierRank(userTier) >= tierRank(requiredTier);
}
