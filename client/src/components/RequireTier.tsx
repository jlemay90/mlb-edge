import { ReactNode } from "react";
import { useAccount, Tier } from "@/hooks/useAccount";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Lock, Zap, Crown } from "lucide-react";
import { useLocation } from "wouter";

const TIER_LABEL: Record<Tier, string> = { free: "Free", pro: "Pro", sharp: "Sharp" };

/**
 * Gate that blurs/locks its children unless the user meets the required tier.
 * - Logged-out users see a "Sign in" prompt.
 * - Logged-in users below the tier see an upgrade prompt linking to /pricing.
 */
export function RequireTier({
  tier,
  children,
  featureName = "This feature",
}: {
  tier: Exclude<Tier, "free">;
  children: ReactNode;
  featureName?: string;
}) {
  const { loading, isAuthenticated, hasTier } = useAccount();
  const [, navigate] = useLocation();

  // While loading, render children optimistically to avoid layout flash.
  if (loading) return <>{children}</>;
  if (hasTier(tier)) return <>{children}</>;

  const Icon = tier === "sharp" ? Crown : Zap;

  return (
    <div className="relative">
      {/* Blurred preview of the gated content */}
      <div className="pointer-events-none select-none blur-sm opacity-40" aria-hidden>
        {children}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md text-center shadow-xl">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {featureName} is a {TIER_LABEL[tier]} feature
          </h3>
          {isAuthenticated ? (
            <>
              <p className="text-muted-foreground mt-2 text-sm">
                Upgrade to <span className="font-semibold text-foreground">{TIER_LABEL[tier]}</span> to
                unlock {featureName.toLowerCase()} and the rest of the {TIER_LABEL[tier]} toolkit.
              </p>
              <Button className="mt-5 gap-2" onClick={() => navigate("/pricing")}>
                <Icon className="w-4 h-4" />
                See {TIER_LABEL[tier]} plans
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mt-2 text-sm">
                Start your free trial to unlock the full MLB Edge model — picks, props, and parlays.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button className="gap-2" onClick={() => (window.location.href = getLoginUrl())}>
                  Start free trial
                </Button>
                <Button variant="outline" onClick={() => navigate("/pricing")}>
                  View pricing
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
