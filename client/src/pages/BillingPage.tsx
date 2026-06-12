import { useEffect } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Crown, Zap, Star, TrendingUp, ExternalLink, CheckCircle, AlertCircle, HeartHandshake, Mail, Lock, Gift, Copy } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const TIER_ICONS = {
  free: TrendingUp,
  pro: Zap,
  sharp: Crown,
  syndicate: Star,
};

const TIER_COLORS = {
  free: "text-muted-foreground",
  pro: "text-primary",
  sharp: "text-yellow-400",
  syndicate: "text-yellow-400",
};

const TIER_LABELS = {
  free: "Free",
  pro: "Edge",
  sharp: "Sharp",
  syndicate: "Syndicate",
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
      window.history.replaceState({}, "", "/billing");
    }
    if (params.get("tip") === "success") {
      toast.success("🙏 Thank you for the tip! You're helping keep the model sharp.");
      window.history.replaceState({}, "", "/billing");
    }
  }, []);

  const { data: subscription, isLoading: subLoading, refetch } = trpc.stripe.getSubscription.useQuery(
    undefined,
    { enabled: !!user }
  );

  const { data: referral } = trpc.stripe.getMyReferral.useQuery(
    { origin: typeof window !== "undefined" ? window.location.origin : "" },
    { enabled: !!user }
  );
  const { data: referralStats } = trpc.bets.myReferralStats.useQuery(undefined, { enabled: !!user });

  const createTip = trpc.stripe.createTipCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Redirecting to checkout — thank you for the support! 🙏");
      }
    },
    onError: (err) => {
      toast.error(`Tip checkout error: ${err.message}`);
    },
  });

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
                    {tier === "free" && "One free pick a day — upgrade to unlock everything"}
                    {tier === "pro" && "Every pick, props, line movement, analytics"}
                    {tier === "sharp" && "Parlays + props built by the model"}
                    {tier === "syndicate" && "Everything, earliest, with the raw model"}
                  </div>
                  {subscription?.isFoundingMember && (
                    <Badge className="mt-1 bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs gap-1">
                      <Lock className="h-3 w-3" />
                      Founding Member{subscription?.foundingMemberNumber ? ` #${subscription.foundingMemberNumber}` : ""} — rate locked
                    </Badge>
                  )}
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
                    <p className="text-xs text-primary font-medium">Upgrade to Edge for $9.99/mo — every pick, props, and analytics.</p>
                    <Button size="sm" className="mt-2 h-7 text-xs" onClick={() => setLocation("/pricing")}>View Plans</Button>
                  </div>
                </>
              )}
              {(tier === "pro" || tier === "sharp" || tier === "syndicate") && (
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
              {(tier === "sharp" || tier === "syndicate") && (
                <>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-yellow-400" />
                    5 daily parlays (Power, Value, Lotto, High-Value, HR Prop)
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-yellow-400" />
                    Moonshot HR prop analysis (Statcast-driven)
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-yellow-400" />
                    Steam move alerts + reverse line movement
                  </div>
                </>
              )}
              {tier === "syndicate" && (
                <>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-yellow-400" />
                    Full model-confidence view — raw edge % on every leg
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-yellow-400" />
                    Bankroll & bet tracker (live ROI)
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4 text-yellow-400" />
                    Priority support
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Referral */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4 text-emerald-400" />
              Give a week, get a week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share your link. When a friend signs up and subscribes, you both get a free week of Sharp.
              {typeof referralStats?.successfulReferrals === "number" && referralStats.successfulReferrals > 0 && (
                <span className="text-foreground font-medium"> You've referred {referralStats.successfulReferrals} so far.</span>
              )}
            </p>
            {referral?.link ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted/40 rounded-md px-3 py-2 truncate text-foreground">
                  {referral.link}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(referral.link!);
                    toast.success("Referral link copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sign in to get your referral link.</p>
            )}
          </CardContent>
        </Card>

        {/* Tip Jar */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-pink-400" />
              Support MLB Edge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Love the picks? A tip helps keep the model sharp — funding better data sources, faster updates, and new features.
            </p>
            <div className="flex flex-wrap gap-2">
              {[{label: "$5 Tip", amount: 500}, {label: "$10 Tip", amount: 1000}, {label: "$25 Tip", amount: 2500}].map(({ label, amount }) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  className="gap-1 border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
                  disabled={createTip.isPending}
                  onClick={() => {
                    if (!user) {
                      toast.error("Sign in to send a tip");
                      return;
                    }
                    createTip.mutate({ amount, origin: window.location.origin });
                  }}
                >
                  <HeartHandshake className="h-3 w-3" />
                  {createTip.isPending ? "..." : label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cancel / Support */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Need Help or Want to Cancel?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Before you cancel, reach out — we may be able to help with a pause, discount, or answer any questions about your subscription.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  window.open("mailto:support@intelligentbettingmlbedgepicks.com?subject=MLB Edge Support&body=Hi, I need help with my subscription.", "_blank");
                  toast.info("Opening your email client...");
                }}
              >
                <Mail className="h-4 w-4" />
                Contact Support
              </Button>
              {isPaid && subscription?.customerId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => createPortal.mutate({ origin: window.location.origin })}
                  disabled={createPortal.isPending}
                >
                  <ExternalLink className="h-3 w-3" />
                  {createPortal.isPending ? "Opening..." : "Cancel Subscription"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cancel anytime — no contracts, no questions asked. Cancellation takes effect at the end of your billing period.
            </p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          MLB Edge — Professional-grade betting intelligence. Gamble responsibly.
        </p>
      </div>
    </AppLayout>
  );
}
