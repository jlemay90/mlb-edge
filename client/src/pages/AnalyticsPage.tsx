import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { BarChart3, TrendingUp, RefreshCw, Trophy, Target, Zap } from "lucide-react";
import { RequireTier } from "@/components/RequireTier";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";

function StatCard({ label, value, sub, color = "text-primary" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={cn("text-2xl font-bold tabular-nums", color)}>{value}</div>
      <div className="text-sm font-medium text-foreground mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

const MARKET_COLORS: Record<string, string> = {
  moneyline: "#3b82f6",
  total: "#f97316",
  runline: "#a855f7",
};

const TIER_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#06b6d4",
  C: "#eab308",
  D: "#6b7280",
};

export default function AnalyticsPage() {
  const { data: backtest, isLoading, refetch } = trpc.mlb.getBacktestResults.useQuery();
  const seedMutation = trpc.mlb.seedBacktestData.useMutation({ onSuccess: () => refetch() });

  // Aggregate stats
  const totalPicks = backtest?.reduce((s: number, r: any) => s + (r.totalPicks || 0), 0) || 0;
  const totalWins = backtest?.reduce((s: number, r: any) => s + (r.wins || 0), 0) || 0;
  const overallWinPct = totalPicks > 0 ? ((totalWins / totalPicks) * 100).toFixed(1) : "—";
  const avgROI = backtest?.length
    ? (backtest.reduce((s: number, r: any) => s + (r.roi || 0), 0) / backtest.length).toFixed(1)
    : "—";

  // Chart data — ROI by market
  const roiByMarket = ["moneyline", "total", "runline"].map((market) => {
    const rows = backtest?.filter((r: any) => r.market === market) || [];
    const avgRoi = rows.length ? rows.reduce((s: number, r: any) => s + (r.roi || 0), 0) / rows.length : 0;
    return { market: market.charAt(0).toUpperCase() + market.slice(1), roi: Math.round(avgRoi * 10) / 10 };
  });

  // Chart data — Win% by tier
  const winByTier = ["A", "B", "C", "D"].map((tier) => {
    const rows = backtest?.filter((r: any) => r.confidenceTier === tier) || [];
    const avgWin = rows.length
      ? (rows.reduce((s: number, r: any) => s + (r.winPct || 0), 0) / rows.length) * 100
      : 0;
    return { tier, winPct: Math.round(avgWin * 10) / 10 };
  });

  // Chart data — picks by tier
  const picksByTier = ["A", "B", "C", "D"].map((tier) => {
    const rows = backtest?.filter((r: any) => r.confidenceTier === tier) || [];
    return {
      tier,
      picks: rows.reduce((s: number, r: any) => s + (r.totalPicks || 0), 0),
    };
  });

  return (
    <AppLayout>
      <RequireTier tier="pro" featureName="Model analytics">
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Model Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Backtesting results from 2024 MLB season — historical model performance
            </p>
          </div>
          <div className="flex gap-2">
            {!backtest?.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="gap-2"
              >
                <Zap className="w-4 h-4" />
                Load Demo Data
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : !backtest?.length ? (
          <div className="bg-card border border-border rounded-xl p-16 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No backtest data yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Click "Load Demo Data" to populate with 2024 season results.
            </p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Picks (2024)" value={totalPicks.toLocaleString()} sub="All markets" color="text-blue-400" />
              <StatCard label="Overall Win Rate" value={`${overallWinPct}%`} sub="All tiers" color="text-green-400" />
              <StatCard label="Avg ROI" value={`+${avgROI}%`} sub="Flat $100 units" color="text-primary" />
              <StatCard label="A-Grade ROI" value={`+${backtest.find((r: any) => r.market === "moneyline" && r.confidenceTier === "A")?.roi?.toFixed(1) || "—"}%`} sub="Best tier" color="text-yellow-400" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ROI by market */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> ROI by Market
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={roiByMarket} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.01 240)" />
                    <XAxis dataKey="market" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 12 }} unit="%" />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.14 0.008 240)", border: "1px solid oklch(0.22 0.01 240)", borderRadius: "8px" }}
                      labelStyle={{ color: "oklch(0.95 0.005 240)" }}
                      formatter={(v: any) => [`${v}%`, "ROI"]}
                    />
                    <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                      {roiByMarket.map((entry) => (
                        <Cell key={entry.market} fill={MARKET_COLORS[entry.market.toLowerCase()] || "#6b7280"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Win% by tier */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" /> Win Rate by Confidence Tier
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={winByTier} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.01 240)" />
                    <XAxis dataKey="tier" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 12 }} unit="%" domain={[40, 70]} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.14 0.008 240)", border: "1px solid oklch(0.22 0.01 240)", borderRadius: "8px" }}
                      labelStyle={{ color: "oklch(0.95 0.005 240)" }}
                      formatter={(v: any) => [`${v}%`, "Win Rate"]}
                    />
                    <Bar dataKey="winPct" radius={[4, 4, 0, 0]}>
                      {winByTier.map((entry) => (
                        <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] || "#6b7280"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Detailed Backtest Results — 2024 Season</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Market", "Tier", "Picks", "W", "L", "Win%", "ROI", "Avg Edge", "Avg Odds"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {backtest.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground capitalize">{row.market}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-bold",
                            row.confidenceTier === "A" && "tier-a",
                            row.confidenceTier === "B" && "tier-b",
                            row.confidenceTier === "C" && "tier-c",
                            row.confidenceTier === "D" && "tier-d",
                          )}>
                            {row.confidenceTier}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-foreground tabular-nums">{row.totalPicks}</td>
                        <td className="px-4 py-3 text-green-400 tabular-nums font-medium">{row.wins}</td>
                        <td className="px-4 py-3 text-red-400 tabular-nums font-medium">{row.losses}</td>
                        <td className="px-4 py-3 text-foreground tabular-nums font-semibold">
                          {row.winPct ? `${(row.winPct * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className={cn("px-4 py-3 tabular-nums font-bold",
                          (row.roi || 0) > 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {row.roi != null ? `${row.roi > 0 ? "+" : ""}${row.roi}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">
                          {row.avgEdge ? `+${(row.avgEdge * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">
                          {row.avgOdds ? `${row.avgOdds > 0 ? "+" : ""}${row.avgOdds}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Model methodology */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground">Model Methodology</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-muted-foreground">
                {[
                  { label: "Offensive Metrics", desc: "wRC+, OPS, xBA, xSLG, xwOBA, barrel%, exit velocity, hard-hit%" },
                  { label: "Pitching Metrics", desc: "FIP, xFIP, SIERA, K%, BB%, K-BB%, recent 3-game ERA, days rest" },
                  { label: "Park Factors", desc: "Run, HR, and hit factors for all 30 stadiums — altitude adjusted" },
                  { label: "Weather Impact", desc: "Wind direction/speed, temperature, humidity — run impact calculation" },
                  { label: "Umpire Tendencies", desc: "Zone size, K/BB bias, home favor score, historical runs/game" },
                  { label: "Edge Calculation", desc: "Model probability minus vig-removed book implied probability" },
                ].map(({ label, desc }) => (
                  <div key={label} className="space-y-1">
                    <div className="font-semibold text-foreground">{label}</div>
                    <div>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      </RequireTier>
    </AppLayout>
  );
}
