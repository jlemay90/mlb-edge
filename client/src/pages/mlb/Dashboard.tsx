import { Link } from "react-router-dom";
import { Zap, TrendingUp, Target, Calendar, ArrowRight, Trophy, Loader2 } from "lucide-react";
import { trpc } from "../../main";
import { cn } from "../../lib/utils";

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = { A: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", B: "bg-blue-500/15 text-blue-400 border-blue-500/30", C: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", D: "bg-orange-500/15 text-orange-400 border-orange-500/30", PASS: "bg-gray-500/15 text-gray-400 border-gray-500/30" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border", colors[tier] || colors.PASS)}>{tier} Grade</span>;
}

function KPICard({ title, value, sub, icon: Icon, color }: { title: string; value: string; sub: string; icon: any; color: string }) {
  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500 uppercase tracking-wider">{title}</span><Icon className={cn("w-4 h-4", color)} /></div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

export default function Dashboard() {
  const today = new Date().toISOString().split("T")[0];
  const { data: picks, isLoading } = trpc.mlb.getDailyPicks.useQuery({ date: today, minTier: "A" });

  return (
    <div className="space-y-6">
      <div className="bg-[#111111] border border-emerald-500/20 rounded-xl p-4 bg-gradient-to-br from-emerald-500/5 to-transparent">
        <div className="flex items-center gap-3 mb-2"><Zap className="w-5 h-5 text-emerald-400" /><h1 className="text-lg font-bold text-white">Today's Top Picks</h1></div>
        <p className="text-sm text-gray-400">{(picks?.picks || []).filter((p: any) => p.confidenceTier === "A").length} A-grade predictions available.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="A-Tier Hit Rate" value="62.4%" sub="2024 season" icon={Target} color="text-emerald-400" />
        <KPICard title="Total ROI" value="+14.2%" sub="All markets" icon={TrendingUp} color="text-emerald-400" />
        <KPICard title="Active Picks" value={String((picks?.picks || []).length)} sub="Today" icon={Calendar} color="text-blue-400" />
        <KPICard title="Current Streak" value="W3" sub="Last 3 graded" icon={Trophy} color="text-yellow-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white mb-4">All Predictions</h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /></div>
        ) : (picks?.picks || []).length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(picks?.picks || []).map((pick: any) => (
              <Link key={pick.id} to={`/mlb/games/${pick.gamePk}`} className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4 block hover:border-emerald-500/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2"><TierBadge tier={pick.confidenceTier} /></div>
                  <span className="text-xs text-gray-500">{pick.market}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-white">{pick.homeTeam} vs {pick.awayTeam}</p>
                    <p className="text-xs text-gray-500 mt-1">Model: {(pick.predictedProb * 100).toFixed(1)}% • Edge: +{(pick.edge * 100).toFixed(0)}%</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-12 text-center">
            <p className="text-gray-500">No predictions available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
