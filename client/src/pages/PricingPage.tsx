import { useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Zap, TrendingUp, Crown, Tag } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ─── Pricing constants ────────────────────────────────────────────────────────
// Regular prices (shown as crossed-out "usual" price)
const REG_PRO_MONTHLY = 29;
const REG_SHARP_MONTHLY = 79;

// Promo monthly prices — $10/mo off for first 3 months
const PROMO_PRO_MONTHLY = 19;
const PROMO_SHARP_MONTHLY = 69;

// Annual promo prices — first year only
const PROMO_PRO_ANNUAL = 175;
const PROMO_SHARP_ANNUAL = 500;

// Regular annual (what they'd pay after promo year, at reg monthly × 12)
const REG_PRO_ANNUAL = REG_PRO_MONTHLY * 12;       // $348
const REG_SHARP_ANNUAL = REG_SHARP_MONTHLY * 12;   // $948

// Savings
const PRO_ANNUAL_SAVINGS = REG_PRO_ANNUAL - PROMO_PRO_ANNUAL;       // $173
const SHARP_ANNUAL_SAVINGS = REG_SHARP_ANNUAL - PROMO_SHARP_ANNUAL; // $448

const TIERS = [
  {
    name: "Free",
    tier: "free",
    icon: TrendingUp,
    color: "border-border",
    badge: null,
    description: "Get started with basic MLB picks",
    regMonthly: 0,
    promoMonthly: 0,
    promoAnnual: 0,
    regAnnual: 0,
    annualSavings: 0,
    buttonVariant: "outline" as const,
    features: [
      "Today's top 3 picks (money line only)",
      "Basic game schedule",
      "Team standings",
      "Limited to 1 game detail per day",
    ],
  },
  {
    name: "Pro",
    tier: "pro",
    icon: Zap,
    color: "border-primary ring-1 ring-primary",
    badge: "Most Popular",
    description: "Full access for serious bettors",
    regMonthly: REG_PRO_MONTHLY,
    promoMonthly: PROMO_PRO_MONTHLY,
    promoAnnual: PROMO_PRO_ANNUAL,
    regAnnual: REG_PRO_ANNUAL,
    annualSavings: PRO_ANNUAL_SAVINGS,
    buttonVariant: "default" as const,
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
  {
    name: "Sharp",
    tier: "sharp",
    icon: Crown,
    color: "border-yellow-500/50",
    badge: "Best Value",
    description: "For professional-grade edge hunting",
    regMonthly: REG_SHARP_MONTHLY,
    promoMonthly: PROMO_SHARP_MONTHLY,
    promoAnnual: PROMO_SHARP_ANNUAL,
    regAnnual: REG_SHARP_ANNUAL,
    annualSavings: SHARP_ANNUAL_SAVINGS,
    buttonVariant: "outline" as const,
    features: [
      "Everything in Pro",
      "Parlay builder with correlated picks",
      "Moonshot HR prop analysis (Statcast 420ft+)",
      "Steam move alerts (sharp money signals)",
      "Reverse line movement notifications",
      "Model confidence scores + feature weights",
      "Historical backtesting (50+ years)",
      "Priority support + Discord access",
    ],
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: subscription } = trpc.stripe.getSubscription.useQuery(undefined, {
    enabled: !!user,
  });

  const createCheckout = trpc.stripe.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Redirecting to checkout...");
      }
    },
    onError: (err) => {
      toast.error(`Checkout failed: ${err.message}`);
    },
  });

  function handleUpgrade(tier: "pro" | "sharp") {
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    createCheckout.mutate({
      tier,
      billing: annual ? "annual" : "monthly",
      origin: window.location.origin,
    });
  }

  const currentTier = subscription?.tier || "free";

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Badge className="bg-red-600/20 text-red-400 border-red-600/30 text-xs px-3 py-1 gap-1">
              <Tag className="h-3 w-3" />
              Limited-Time Launch Promo
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-foreground">MLB Edge Pricing</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Professional-grade MLB betting intelligence. Our model hit{" "}
            <span className="text-primary font-semibold">62.4% win rate</span> on A-grade picks in 2024 with{" "}
            <span className="text-green-400 font-semibold">+19.2% ROI</span>.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Label className="text-sm text-muted-foreground">Monthly</Label>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              Annual
              <Badge className="text-xs bg-green-600 text-white">
                Save up to ${SHARP_ANNUAL_SAVINGS} first year
              </Badge>
            </Label>
          </div>

          {/* Promo callout */}
          {!annual && (
            <p className="text-xs text-yellow-400/80 font-medium">
              🎉 Launch promo: $10/mo off your first 3 months — then regular pricing applies.
            </p>
          )}
          {annual && (
            <p className="text-xs text-yellow-400/80 font-medium">
              🎉 Launch promo: First-year annual rate — renews at regular annual pricing after year 1.
            </p>
          )}
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const isPro = tier.tier === "pro";
            const isSharp = tier.tier === "sharp";
            const isFree = tier.tier === "free";
            const isCurrentTier = currentTier === tier.tier;

            // Displayed price
            const displayPrice = annual && !isFree ? tier.promoAnnual : (!isFree ? tier.promoMonthly : 0);
            const perMonth = annual && !isFree ? Math.round(tier.promoAnnual / 12) : tier.promoMonthly;

            return (
              <Card
                key={tier.tier}
                className={`relative bg-card ${tier.color} transition-all hover:shadow-lg hover:shadow-primary/10`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge
                      className={`text-xs px-3 py-1 ${
                        isPro ? "bg-primary text-primary-foreground" : "bg-yellow-500 text-black"
                      }`}
                    >
                      {tier.badge}
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4 pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon
                      className={`h-5 w-5 ${
                        isPro ? "text-primary" : isSharp ? "text-yellow-400" : "text-muted-foreground"
                      }`}
                    />
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                    {isCurrentTier && (
                      <Badge variant="outline" className="text-xs text-green-400 border-green-400/50">
                        Current Plan
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    {isFree ? (
                      <div className="text-3xl font-bold text-foreground">Free</div>
                    ) : (
                      <>
                        {/* Promo price */}
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-foreground">
                            ${annual ? perMonth : displayPrice}
                          </span>
                          <span className="text-muted-foreground text-sm">/mo</span>
                          {/* Crossed-out regular price */}
                          <span className="text-sm text-muted-foreground line-through">
                            ${annual ? Math.round(tier.regAnnual / 12) : tier.regMonthly}/mo
                          </span>
                        </div>

                        {/* Annual total + savings */}
                        {annual ? (
                          <div className="space-y-0.5">
                            <div className="text-xs text-muted-foreground">
                              Billed{" "}
                              <span className="text-foreground font-medium">${tier.promoAnnual}</span>
                              {" "}for first year{" "}
                              <span className="text-muted-foreground line-through">${tier.regAnnual}</span>
                            </div>
                            <div className="text-xs text-green-400 font-semibold">
                              You save ${tier.annualSavings} this year
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-yellow-400/80">
                            Promo: $10/mo off first 3 months (saves $30)
                          </div>
                        )}
                      </>
                    )}
                    <p className="text-sm text-muted-foreground pt-1">{tier.description}</p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check
                          className={`h-4 w-4 mt-0.5 shrink-0 ${
                            isPro ? "text-primary" : isSharp ? "text-yellow-400" : "text-muted-foreground"
                          }`}
                        />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isFree ? (
                    <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
                      {user ? "You're on Free" : "Get Started Free"}
                    </Button>
                  ) : isCurrentTier ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      variant={tier.buttonVariant}
                      className={`w-full ${
                        isPro
                          ? "bg-primary hover:bg-primary/90"
                          : "border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-400"
                      }`}
                      onClick={() => handleUpgrade(tier.tier as "pro" | "sharp")}
                      disabled={createCheckout.isPending}
                    >
                      {createCheckout.isPending
                        ? "Loading..."
                        : `Upgrade to ${tier.name} — $${annual ? tier.promoAnnual + "/yr" : displayPrice + "/mo"}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Fine print on promo */}
        <div className="bg-muted/20 border border-border rounded-lg p-4 text-xs text-muted-foreground space-y-1 max-w-2xl mx-auto">
          <p className="font-semibold text-foreground text-sm">Promo Details</p>
          <p>
            <span className="text-yellow-400">Monthly promo:</span> First 3 months at $10/mo off. Pro billed at $19/mo × 3, then $29/mo. Sharp billed at $69/mo × 3, then $79/mo.
          </p>
          <p>
            <span className="text-yellow-400">Annual promo:</span> First year at the promo rate ($175 for Pro, $500 for Sharp). Renews at regular annual rate ($348 for Pro, $948 for Sharp) after year 1. Cancel anytime before renewal.
          </p>
        </div>

        {/* Backtest proof */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "2024 A-Grade Win Rate", value: "62.4%", sub: "Money line picks", color: "text-green-400" },
            { label: "2024 A-Grade ROI", value: "+19.2%", sub: "1 unit flat bet", color: "text-green-400" },
            { label: "Games Analyzed", value: "2,430", sub: "Full 2024 MLB season", color: "text-primary" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-muted/20 border-border text-center">
              <CardContent className="p-4">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-sm font-medium text-foreground mt-1">{stat.label}</div>
                <div className="text-xs text-muted-foreground">{stat.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center text-xs text-muted-foreground max-w-2xl mx-auto pb-4">
          Past performance is not indicative of future results. Sports betting involves risk.
          Cancel anytime — no contracts. Test card: 4242 4242 4242 4242.
        </div>
      </div>
    </AppLayout>
  );
}
