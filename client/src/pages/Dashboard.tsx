import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/hooks/useAccount";
import { Lock } from "lucide-react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import {
  TrendingUp,
  Zap,
  CloudRain,
  Wind,
  Thermometer,
  ChevronRight,
  Trophy,
  Target,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wider",
        tier === "A" && "tier-a",
        tier === "B" && "tier-b",
        tier === "C" && "tier-c",
        tier === "D" && "tier-d"
      )}
    >
      {tier}
    </span>
  );
}

function EdgeBadge({ edge }: { edge: number }) {
  const pct = Math.round(edge * 100);
  const color =
    pct >= 8
      ? "text-green-400"
      : pct >= 5
      ? "text-cyan-400"
      : pct >= 3
      ? "text-yellow-400"
      : "text-muted-foreground";
  return (
    <span className={cn("text-sm font-bold tabular-nums", color)}>
      +{pct}%
    </span>
  );
}

function MarketBadge({ market }: { market: string }) {
  const labels: Record<string, string> = {
    moneyline: "ML",
    runline: "RL",
    total: "TOT",
    prop: "PROP",
  };
  const colors: Record<string, string> = {
    moneyline: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    runline: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    total: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    prop: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border",
        colors[market] || "bg-secondary text-muted-foreground border-border"
      )}
    >
      {labels[market] || market.toUpperCase()}
    </span>
  );
}

function PickCard({ pick }: { pick: any }) {
  const edgePct = Math.round((pick.edgeScore || 0) * 100);
  const modelPct = Math.round((pick.modelProbability || 0) * 100);
  const impliedPct = Math.round((pick.impliedProbability || 0) * 100);

  return (
    <div className="pick-card bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <MarketBadge market={pick.market} />
          <TierBadge tier={pick.confidenceTier} />
        </div>
        <EdgeBadge edge={pick.edgeScore || 0} />
      </div>

      {/* Matchup */}
      <div className="text-xs text-muted-foreground font-medium">
        {pick.awayAbbr || pick.awayTeam?.split(" ").pop()} @{" "}
        {pick.homeAbbr || pick.homeTeam?.split(" ").pop()}
      </div>

      {/* Pick label */}
      <div className="text-sm font-semibold text-foreground leading-snug">
        {pick.pickLabel}
      </div>

      {/* Probability bars */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Model</span>
          <span className="font-medium text-foreground">{modelPct}%</span>
        </div>
        <div className="stat-bar">
          <div
            className="stat-bar-fill bg-primary"
            style={{ width: `${modelPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Book Implied</span>
          <span className="font-medium text-muted-foreground">{impliedPct}%</span>
        </div>
        <div className="stat-bar">
          <div
            className="stat-bar-fill bg-muted-foreground/40"
            style={{ width: `${impliedPct}%` }}
          />
        </div>
      </div>

      {/* Pitchers */}
      {/* Rationale */}
      {pick.rationale && (
        <div className="text-xs text-muted-foreground border-t border-border pt-2 leading-relaxed">
          {pick.rationale}
        </div>
      )}
      {(pick.homePitcher || pick.awayPitcher) && (
        <div className="text-xs text-muted-foreground">
          {(typeof pick.awayPitcher === "object" ? pick.awayPitcher?.name : pick.awayPitcher) || "TBD"} vs {(typeof pick.homePitcher === "object" ? pick.homePitcher?.name : pick.homePitcher) || "TBD"}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "text-primary",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className={cn("mt-0.5", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const today = new Date().toISOString().split("T")[0];
  const { isPro, isSharp, loading: accountLoading } = useAccount();
  const isPaid = isPro || isSharp;
  const [, navigate] = useLocation();

  const {
    data: topPicks,
    isLoading: picksLoading,
    refetch: refetchPicks,
  } = trpc.mlb.getTopPicks.useQuery({ date: today, minTier: "C" });

  const { data: games, isLoading: gamesLoading } = trpc.mlb.getTodaysGames.useQuery({ date: today });

  const aGrade = topPicks?.filter((p: any) => p.confidenceTier === "A") || [];
  const bGrade = topPicks?.filter((p: any) => p.confidenceTier === "B") || [];
  const totalGames = games?.length || 0;

  // Free tier: show only 1 pick (title only), blur the rest
  const visiblePicks = isPaid ? (topPicks || []) : (topPicks || []).slice(0, 1);
  const hiddenPickCount = isPaid ? 0 : Math.max(0, (topPicks?.length || 0) - 1);

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              MLB Edge{" "}
              <span className="gradient-text">Dashboard</span>
            </h1>
            <p className="text-muted-foreground mt-1">{formattedDate}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchPicks()}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Today's Games"
            value={gamesLoading ? "—" : totalGames}
            sub="MLB schedule"
            icon={Activity}
            color="text-blue-400"
          />
          <StatCard
            label="Total Picks"
            value={picksLoading ? "—" : topPicks?.length || 0}
            sub="Edge detected"
            icon={Target}
            color="text-primary"
          />
          <StatCard
            label="A-Grade Picks"
            value={picksLoading ? "—" : aGrade.length}
            sub="+8% edge or more"
            icon={Trophy}
            color="text-green-400"
          />
          <StatCard
            label="B-Grade Picks"
            value={picksLoading ? "—" : bGrade.length}
            sub="+5–8% edge"
            icon={TrendingUp}
            color="text-cyan-400"
          />
        </div>

        {/* Top picks */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Top Picks Today</h2>
              <span className="text-xs text-muted-foreground">Ranked by edge score</span>
            </div>
            <Link href="/games">
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                View all games <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {picksLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : !topPicks?.length ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No picks available yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Games may not have opened lines yet. Check back closer to game time.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Free tier: show 1 pick title-only (no analysis) */}
                {visiblePicks.slice(0, 12).map((pick: any, i: number) => (
                  isPaid ? (
                    <PickCard key={`${pick.gamePk}-${pick.market}-${i}`} pick={pick} />
                  ) : (
                    // Free tier: title only, no odds/analysis/bars
                    <div key={`${pick.gamePk}-${pick.market}-${i}`} className="pick-card bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wider tier-a">{pick.confidenceTier}</span>
                      </div>
                      <div className="text-sm font-semibold text-foreground">{pick.pickLabel}</div>
                      <div className="text-xs text-muted-foreground">{pick.awayAbbr || pick.awayTeam?.split(" ").pop()} @ {pick.homeAbbr || pick.homeTeam?.split(" ").pop()}</div>
                      <div className="mt-1 text-xs text-muted-foreground italic">Analysis hidden — upgrade to view</div>
                    </div>
                  )
                ))}
              </div>

              {/* Paywall overlay for free users */}
              {!isPaid && !accountLoading && hiddenPickCount > 0 && (
                <div className="relative rounded-xl overflow-hidden">
                  {/* Blurred ghost picks */}
                  <div className="pointer-events-none select-none blur-md opacity-30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-hidden>
                    {Array.from({ length: Math.min(hiddenPickCount, 8) }).map((_, i) => (
                      <div key={i} className="pick-card bg-card border border-border rounded-xl p-4 h-40" />
                    ))}
                  </div>
                  {/* Upgrade CTA */}
                  <div className="absolute inset-0 flex items-center justify-center p-6">
                    <div className="bg-card border border-primary/40 rounded-2xl p-6 max-w-sm text-center shadow-xl">
                      <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-base font-bold text-foreground">{hiddenPickCount} more picks hidden</h3>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Start Pro for $9.99 to unlock all picks, odds, analysis, and player props.
                      </p>
                      <Button className="mt-4 gap-2 w-full" size="sm" onClick={() => navigate("/pricing")}>
                        <Zap className="w-3.5 h-3.5" />
                        Start Pro — $9.99
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Today's games preview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-foreground">Today's Slate</h2>
            </div>
            <Link href="/games">
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                Full analysis <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {gamesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : !games?.length ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-muted-foreground">No games scheduled today.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {games.slice(0, 6).map((game: any) => (
                <Link key={game.gamePk} href={`/games/${game.gamePk}`}>
                  <div className="pick-card bg-card border border-border rounded-xl p-4 flex items-center gap-4 cursor-pointer">
                    {/* Teams */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-foreground">
                          {game.awayTeam?.abbreviation || game.awayTeam?.name?.split(" ").pop()}{" "}
                          <span className="text-muted-foreground">@</span>{" "}
                          {game.homeTeam?.abbreviation || game.homeTeam?.name?.split(" ").pop()}
                        </div>
                        {game.status === "In Progress" && (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <span className="live-dot w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {(typeof game.awayPitcher === "object" ? game.awayPitcher?.name : game.awayPitcher) || "TBD"} vs {(typeof game.homePitcher === "object" ? game.homePitcher?.name : game.homePitcher) || "TBD"}
                      </div>
                    </div>

                    {/* Weather */}
                    {game.weather && (
                      <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Thermometer className="w-3 h-3" />
                          {game.weather.temp ?? game.weather.tempF ?? 72}°F
                        </span>
                        <span className="flex items-center gap-1">
                          <Wind className="w-3 h-3" />
                          {game.weather.windSpeed ?? game.weather.windSpeedMph ?? 8} mph {game.weather.windDir ?? game.weather.windDirLabel ?? ""}
                        </span>
                        {game.weather.runImpact !== 0 && (
                          <span
                            className={cn(
                              "font-medium",
                              game.weather.runImpact > 0 ? "text-red-400" : "text-blue-400"
                            )}
                          >
                            {game.weather.runImpact > 0 ? "+" : ""}
                            {game.weather.runImpact} runs
                          </span>
                        )}
                      </div>
                    )}

                    {/* Top pick */}
                    {game.predictions?.topPick && (
                      <div className="flex items-center gap-2 shrink-0">
                        <TierBadge tier={game.predictions.topPick.confidenceTier} />
                        <EdgeBadge edge={game.predictions.topPick.edgeScore} />
                      </div>
                    )}

                    {/* Projected total */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-foreground">
                        {game.predictions?.projectedTotal?.toFixed(1) || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">proj total</div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Model legend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Confidence Tier Guide</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { tier: "A", label: "Elite Edge", desc: "+8%+ model advantage", color: "text-green-400" },
              { tier: "B", label: "Strong Edge", desc: "+5–8% model advantage", color: "text-cyan-400" },
              { tier: "C", label: "Moderate Edge", desc: "+3–5% model advantage", color: "text-yellow-400" },
              { tier: "D", label: "Marginal Edge", desc: "+2–3% model advantage", color: "text-muted-foreground" },
            ].map(({ tier, label, desc, color }) => (
              <div key={tier} className="flex items-start gap-2">
                <TierBadge tier={tier} />
                <div>
                  <div className={cn("text-xs font-semibold", color)}>{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Activity({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
