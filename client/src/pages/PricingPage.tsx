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
import { Check, Zap, TrendingUp, Crown } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const TIERS = [
  {
    name: "Free",
    tier: "free",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Get started with basic MLB picks",
    badge: null,
    icon: TrendingUp,
    color: "border-border",
    buttonVariant: "outline" as const,
    features: [
      "Today's top 3 picks (money line only)",
      "Basic game schedule",
      "Team standings",
      "Limited to 1 game detail per day",
    ],
    locked: [],
  },
  {
    name: "Pro",
    tier: "pro",
    monthlyPrice: 29,
    annualPrice: 249,
    description: "Full access for serious bettors",
    badge: "Most Popular",
    icon: Zap,
    color: "border-primary ring-1 ring-primary",
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
    locked: [],
  },
  {
    name: "Sharp",
    tier: "sharp",
    monthlyPrice: 79,
    annualPrice: 699,
    description: "For professional-grade edge hunting",
    badge: "Best Value",
    icon: Crown,
    color: "border-yellow-500/50",
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
    locked: [],
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
  const annualSavings = { pro: Math.round((29 * 12 - 249) / (29 * 12) * 100), sharp: Math.round((79 * 12 - 699) / (79 * 12) * 100) };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
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
            <Label className="text-sm text-muted-foreground">
              Annual{" "}
              <Badge className="ml-1 text-xs bg-green-600 text-white">Save up to {annualSavings.sharp}%</Badge>
            </Label>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const price = annual && tier.monthlyPrice > 0 ? tier.annualPrice : tier.monthlyPrice;
            const perMonth = annual && tier.monthlyPrice > 0
              ? Math.round(tier.annualPrice / 12)
              : tier.monthlyPrice;
            const isCurrentTier = currentTier === tier.tier;
            const isPro = tier.tier === "pro";
            const isSharp = tier.tier === "sharp";

            return (
              <Card
                key={tier.tier}
                className={`relative bg-card ${tier.color} transition-all hover:shadow-lg hover:shadow-primary/10`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className={`text-xs px-3 py-1 ${isPro ? "bg-primary text-primary-foreground" : "bg-yellow-500 text-black"}`}>
                      {tier.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-4 pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-5 w-5 ${isPro ? "text-primary" : isSharp ? "text-yellow-400" : "text-muted-foreground"}`} />
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                    {isCurrentTier && (
                      <Badge variant="outline" className="text-xs text-green-400 border-green-400/50">
                        Current Plan
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    {tier.monthlyPrice === 0 ? (
                      <div className="text-3xl font-bold text-foreground">Free</div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-foreground">${perMonth}</span>
                          <span className="text-muted-foreground text-sm">/mo</span>
                        </div>
                        {annual && (
                          <div className="text-xs text-muted-foreground">
                            Billed ${price}/year
                          </div>
                        )}
                      </>
                    )}
                    <p className="text-sm text-muted-foreground">{tier.description}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className={`h-4 w-4 mt-0.5 shrink-0 ${isPro ? "text-primary" : isSharp ? "text-yellow-400" : "text-muted-foreground"}`} />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {tier.tier === "free" ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setLocation("/")}
                    >
                      {user ? "You're on Free" : "Get Started Free"}
                    </Button>
                  ) : isCurrentTier ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      variant={tier.buttonVariant}
                      className={`w-full ${isPro ? "bg-primary hover:bg-primary/90" : "border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-400"}`}
                      onClick={() => handleUpgrade(tier.tier as "pro" | "sharp")}
                      disabled={createCheckout.isPending}
                    >
                      {createCheckout.isPending ? "Loading..." : `Upgrade to ${tier.name}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Backtest proof section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
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

        {/* FAQ / disclaimer */}
        <div className="text-center text-xs text-muted-foreground max-w-2xl mx-auto pb-4">
          <p>
            Past performance is not indicative of future results. Sports betting involves risk.
            Cancel anytime — no contracts. Test card: 4242 4242 4242 4242.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
