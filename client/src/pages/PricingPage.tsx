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
import { Check, Zap, Crown, Star, Lock } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

type PaidTier = "pro" | "sharp" | "syndicate" | "founder";

const ICONS: Record<string, any> = { pro: Zap, sharp: Crown, syndicate: Star, founder: Crown };

function dollars(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: pricing } = trpc.stripe.getPricing.useQuery();
  const { data: founding } = trpc.stripe.getFoundingStatus.useQuery();
  const { data: record } = trpc.mlb.getPublicRecord.useQuery(undefined);
  const { data: subscription } = trpc.stripe.getSubscription.useQuery(undefined, {
    enabled: !!user,
  });

  const createCheckout = trpc.stripe.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Redirecting to secure checkout...");
      }
    },
    onError: (err) => toast.error(`Checkout failed: ${err.message}`),
  });

  function handleUpgrade(tier: PaidTier) {
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    createCheckout.mutate({
      tier: tier as "pro" | "sharp" | "syndicate" | "founder",
      billing: tier === "founder" ? "monthly" : (annual ? "annual" : "monthly"),
      origin: window.location.origin,
    });
  }

  const currentTier = subscription?.tier || "free";
  const paidTiers = (pricing || []).filter((t: any) => t.tier !== "free");
  const spotsLeft = founding?.remaining ?? null;
  const foundingActive = (founding?.remaining ?? 0) > 0;
  // Only show the live "X of 500 left" number once real momentum exists.
  // Below the reveal threshold we keep the offer/badge but hide the count so a
  // low or zero number never signals "nobody's here."
  const showCounter = foundingActive && Boolean(founding?.showCounter) && spotsLeft != null;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          {foundingActive && (
            <div className="flex items-center justify-center">
              <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs px-3 py-1 gap-1">
                <Lock className="h-3 w-3" />
                Founding 500 — lock your rate for life
              </Badge>
            </div>
          )}
          <h1 className="text-3xl font-bold text-foreground">Choose your edge</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            One free pick a day, no card required. Upgrade for every pick, model-built parlays,
            and the raw model.
          </p>

          {/* Live record strip (real, not a claim) */}
          {record && record.totalGraded > 0 && (
            <div className="inline-flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-2 text-sm">
              <span className="text-muted-foreground">Last 14 days (graded parlays):</span>
              <span className="font-bold text-green-400">{record.wins}W</span>
              <span className="text-muted-foreground">–</span>
              <span className="font-bold text-red-400">{record.losses}L</span>
              {record.pushes > 0 && (
                <span className="text-muted-foreground">· {record.pushes} push</span>
              )}
              {record.winPct != null && (
                <span className="text-foreground font-semibold">
                  ({Math.round(record.winPct)}%)
                </span>
              )}
            </div>
          )}

          {/* Founding live counter — only once it reads as momentum */}
          {showCounter ? (
            <p className="text-sm text-yellow-400 font-medium">
              {spotsLeft} of {founding?.cap} founding spots left — your rate never goes up.
            </p>
          ) : foundingActive ? (
            <p className="text-sm text-yellow-400 font-medium">
              Founding rate — lock it in now and your price never goes up.
            </p>
          ) : null}

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Label className="text-sm text-muted-foreground">Monthly</Label>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              Annual
              <Badge className="text-xs bg-green-600 text-white">~2 months free</Badge>
            </Label>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {paidTiers.map((tier: any) => {
            const Icon = ICONS[tier.tier] || Zap;
            const isCurrentTier = currentTier === tier.tier;
            const highlight = tier.highlight;
            const priceCents = annual ? tier.annualPrice : tier.monthlyPrice;
            const perMonthCents = annual ? Math.round(tier.annualPrice / 12) : tier.monthlyPrice;

            return (
              <Card
                key={tier.tier}
                className={`relative bg-card transition-all hover:shadow-lg hover:shadow-primary/10 ${
                  highlight ? "border-primary ring-1 ring-primary" : "border-border"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge
                      className={`text-xs px-3 py-1 whitespace-nowrap ${
                        highlight
                          ? "bg-primary text-primary-foreground"
                          : tier.tier === "syndicate"
                          ? "bg-yellow-500 text-black"
                          : "bg-muted text-foreground"
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
                        tier.tier === "syndicate"
                          ? "text-yellow-400"
                          : highlight
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                    {isCurrentTier && (
                      <Badge variant="outline" className="text-xs text-green-400 border-green-400/50">
                        Current
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-foreground">
                        {tier.tier === "founder" ? "$50" : `$${dollars(perMonthCents)}`}
                      </span>
                      <span className="text-muted-foreground text-sm">{tier.tier === "founder" ? "one-time" : "/mo"}</span>
                    </div>
                    {annual ? (
                      <div className="text-xs text-muted-foreground">
                        Billed <span className="text-foreground font-medium">${dollars(priceCents)}</span>/yr
                        {tier.annualSavingsLabel && (
                          <span className="text-green-400 font-medium"> · {tier.annualSavingsLabel}</span>
                        )}
                      </div>
                    ) : (
                      foundingActive && (
                        <div className="text-xs text-yellow-400/90">
                          Founding rate — locked for life if you join now
                        </div>
                      )
                    )}
                    <p className="text-sm text-muted-foreground pt-1">{tier.description}</p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {tier.features.map((feature: string) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check
                          className={`h-4 w-4 mt-0.5 shrink-0 ${
                            tier.tier === "syndicate"
                              ? "text-yellow-400"
                              : highlight
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentTier ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      variant={highlight ? "default" : "outline"}
                      className={`w-full ${
                        highlight
                          ? "bg-primary hover:bg-primary/90"
                          : tier.tier === "syndicate"
                          ? "border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-400"
                          : ""
                      }`}
                      onClick={() => handleUpgrade(tier.tier as PaidTier)}
                      disabled={createCheckout.isPending}
                    >
                      {createCheckout.isPending ? "Loading..." : `Get ${tier.name}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Free tier note */}
        <div className="text-center">
          <Button variant="ghost" className="text-sm text-muted-foreground" onClick={() => setLocation("/free-pick")}>
            Not ready? See today's free pick first →
          </Button>
        </div>

        {/* Fine print */}
        <div className="text-center text-xs text-muted-foreground max-w-2xl mx-auto pb-4 space-y-1">
          <p>
            Founding members keep their join-rate for as long as their subscription stays active.
            Cancel anytime — no contracts.
          </p>
          <p>
            For entertainment and informational purposes only. Past performance does not guarantee
            future results. Sports betting involves risk. 21+. If you or someone you know has a
            gambling problem, call 1-800-GAMBLER.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
