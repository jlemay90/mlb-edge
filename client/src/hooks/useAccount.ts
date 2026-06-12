import { trpc } from "@/lib/trpc";

export type Tier = "free" | "pro" | "sharp" | "syndicate";

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, sharp: 2, syndicate: 3 };

/**
 * Central hook for auth + subscription tier. Use this for any paywall gating.
 * Returns the current tier ("free" when logged out) and helpers to check access.
 */
export function useAccount() {
  const { data, isLoading, refetch } = trpc.auth.myAccount.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const status = data?.status ?? null;
  // A subscription grants access while active OR trialing. Past-due keeps
  // access briefly (Stripe retries), canceled/free does not.
  const accessOk = status === null || status === "active" || status === "trialing" || status === "past_due";
  const tier: Tier = accessOk ? ((data?.tier as Tier) ?? "free") : "free";
  const isAuthenticated = Boolean(data?.authenticated);

  /** True when the user's tier is at or above the required tier. */
  const hasTier = (required: Tier) => TIER_RANK[tier] >= TIER_RANK[required];

  return {
    loading: isLoading,
    isAuthenticated,
    tier,
    status,
    isTrialing: status === "trialing",
    periodEnd: data?.periodEnd ? new Date(data.periodEnd) : null,
    user: data?.user ?? null,
    hasTier,
    isPro: hasTier("pro"),
    isSharp: hasTier("sharp"),
    isSyndicate: hasTier("syndicate"),
    refetch,
  };
}
