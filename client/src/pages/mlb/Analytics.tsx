import { useState } from "react";
import { BarChart3, TrendingUp, Target, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { trpc } from "../../main";
import { cn } from "../../lib/utils";

const kpiData = [
  { label: "Total ROI", value: "+14.2%", sub: "All time", icon: TrendingUp, color: "text-emerald-400" },
  { label: "Sharpe Ratio", value: "1.34", sub: "Risk-adjusted", icon: BarChart3, color: "text-blue-400" },
  { label: "Max Drawdown", value: "-8.1%", sub: "Worst streak", icon: AlertTriangle, color: "text-orange-400" },
  { label: "A-Tier Hit Rate", value: "62.4%", sub: "n=247", icon: Target, color: "text-emerald-400" },
];

const tiers = [
  { tier: "A", hitRate: 62.4, roi: 18.5, bets: 247 },
  { tier: "B", hitRate: 58.1, roi: 12.3, bets: 412 },
  { tier: "C", hitRate: 53.2, roi: 4.1, bets: 189 },
  { tier: "D", hitRate: 48.9, roi: -2.8, bets: 98 },
];

export default function Analytics() {
  const [dateRange, setDateRange] = useState("30d");
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const { data: metrics } = trpc.mlb.getModelMetrics.useQuery();
  const { data: losses } = trpc.mlb.getLossAnalysis.useQuery({ start: thirtyDaysAgo, end: today });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="bg-[#111111] border border-[#1a1a1a] rounded-lg px-3 py-2 text-sm text-white">
          <option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="90d">Last 90 Days</option>
        </select>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map(kpi => (
          <div key={kpi.label} className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500 uppercase">{kpi.label}</span><kpi.icon className={cn("w-4 h-4", kpi.color)} /></div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Performance by Tier</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-[#1a1a1a]"><th className="pb-2">Tier</th><th className="pb-2">Hit Rate</th><th className="pb-2">ROI</th><th className="pb-2">Bets</th></tr></thead>
            <tbody>
              {tiers.map(row => (
                <tr key={row.tier} className="border-b border-[#1a1a1a]/50">
                  <td className="py-3"><span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold", row.tier === "A" ? "bg-emerald-500/15 text-emerald-400" : row.tier === "B" ? "bg-blue-500/15 text-blue-400" : row.tier === "C" ? "bg-yellow-500/15 text-yellow-400" : "bg-orange-500/15 text-orange-400")}>{row.tier}</span></td>
                  <td className="py-3 text-white">{row.hitRate}%</td>
                  <td className={cn("py-3", row.roi >= 0 ? "text-emerald-400" : "text-red-400")}>{row.roi >= 0 ? "+" : ""}{row.roi}%</td>
                  <td className="py-3 text-gray-500">{row.bets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-400" />Loss Analysis</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-[#1a1a1a]"><th className="pb-2">Game</th><th className="pb-2">Date</th><th className="pb-2">Market</th><th className="pb-2">Reason</th></tr></thead>
            <tbody>
              {(losses?.losses || []).map((loss: any, i: number) => (
                <tr key={i} className="border-b border-[#1a1a1a]/50">
                  <td className="py-3 font-medium text-white">{loss.game}</td>
                  <td className="py-3 text-gray-500">{loss.date}</td>
                  <td className="py-3 text-white">{loss.market}</td>
                  <td className="py-3 text-gray-500">{loss.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <div><h3 className="font-semibold text-white">Yesterday's Results</h3><p className="text-sm text-gray-400">3-2 record • +1.4 units</p></div>
          <button className="ml-auto bg-emerald-500 text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-400">Grade Full Day</button>
        </div>
      </div>
    </div>
  );
}
