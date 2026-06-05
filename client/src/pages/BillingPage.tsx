import { useEffect } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Crown, Zap, TrendingUp, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const TIER_ICONS = {
  free: TrendingUp,
  pro: Zap,
  sharp: Crown,
};

const TIER_COLORS = {
  free: "text-muted-foreground",
  pro: "text-primary",
  sharp: "text-yellow-400",
};

const TIER_LABELS = {
  free: "Free",
  pro: "Pro",
  sharp: "Sharp",
};

export default function BillingPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Check for success redirect from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      const tier = params.get("tier");
      toast.success(`🎉 Welcome to MLB Edge ${tier ? TIER_LABELS[tier as keyof typeof TIER_LABELS] || tier : ""}! Your subscription is active.`);
      // Clean up URL
      window.history.replaceState({}, "", "/billing");
    }
  }, []);

  const { data: subscription, isLoading: subLoading, refetch } = trpc.stripe.getSubscription.useQuery(
    undefined,
    { enabled: !!user }
  );

  const createPortal = trpc.stripe.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Opening billing portal...");
      }
    },
    onError: (err) => {
      toast.error(`Portal error: ${err.message}`);
    },
  });

  if (loading || subLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="text-muted-foreground">Loading subscription details...</div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-foreground">Sign in to manage your subscription</h2>
          <Button onClick={() => { window.location.href = getLoginUrl(); }}>
            Sign In
          </Button>
        </div>
      </AppLayout>
    );
  }

  const tier = (subscription?.tier || "free") as keyof typeof TIER_ICONS;
  const status = subscription?.status || "active";
  const Icon = TIER_ICONS[tier];
  const tierColor = TIER_COLORS[tier];
  const isActive = status === "active";
  const isPaid = tier !== "free";

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing & Subscription</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your MLB Edge subscription</p>
        </div>

        {/* Current plan card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Current Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted/30`}>
                  <Icon className={`h-6 w-6 ${tierColor}`} />
                </div>
                <div>
                  <div className="font-semibold text-foreground text-lg">
                    MLB Edge {TIER_LABELS[tier]}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {tier === "free" && "Teaser access — start your trial to unlock everything"}
                    {tier === "pro" && "Full picks, props, line movement, analytics"}
                    {tier === "sharp" && "Professional-grade edge hunting + parlay builder"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isActive ? (
                  <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge className="bg-red-600/20 text-red-400 border-red-600/30">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {status}
                  </Badge>
                )}
              </div>
            </div>

            {isPaid && subscription?.customerId && (
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => createPortal.mutate({ origin: window.location.origin })}
                  disabled={createPortal.isPending}
                >
                  <ExternalLink className="h-4 w-4" />
                  {createPortal.isPending ? "Opening..." : "Manage Subscription"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Update payment method, view invoices, or cancel your subscription via the Stripe billing portal.
                </p>
              </div>
            )}

            {!isPaid && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  Upgrade to unlock all picks, player props, line movement tracking, and advanced analytics.
                </p>
                <Button onClick={() => setLocation("/pricing")} className="gap-2">
                  <Zap className="h-4 w-4" />
                  View Pricing Plans
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* What's included */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">What's Included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {tier === "free" && (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    Today's top pick (title only, no analysis)
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    Basic game schedule
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    Team standings (no stats)
                  </div>
                  <div className="mt-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-xs text-primary font-medium">Start your 7-day Pro trial for just $5 — full picks, props, and analytics.</p>
                    <Button size="sm" className="mt-2 h-7 text-xs" onClick={() => setLocation("/pricing")}>Start Trial — $5</Button>
                  </div>
                </>
              )}
              {(tier === "pro" || tier === "sharp") && (
                <>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    All picks — money line, run line, totals
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Full player props (HR, K, hits, RBI, SB)
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Live line movement tracking
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Game detail with umpire + weather analysis
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Analytics & backtesting dashboard
                  </div>
                </>
              )}
              {tier === "sharp" && (
                <>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-yellow-400" />
                    Parlay builder with correlated picks
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-yellow-400" />
                    Moonshot HR prop analysis (Statcast 420ft+)
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-yellow-400" />
                    Steam move alerts + reverse line movement
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-yellow-400" />
                    Priority support + Discord access
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Questions? Contact support. Cancel anytime — no contracts.
        </p>
      </div>
    </AppLayout>
  );
}
