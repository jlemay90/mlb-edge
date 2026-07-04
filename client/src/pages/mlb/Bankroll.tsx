import { useState } from "react";
import { DollarSign, TrendingUp, Calculator, PiggyBank } from "lucide-react";
import { trpc } from "../../main";
import { cn } from "../../lib/utils";

export default function Bankroll() {
  const [bankroll, setBankroll] = useState(1000);
  const [kellyFraction, setKellyFraction] = useState(0.25);
  const [edge, setEdge] = useState(0.08);

  const { data: snapshot } = trpc.mlb.getBankrollSnapshot.useQuery();
  const { data: history } = trpc.mlb.getBankrollHistory.useQuery();
  const { data: kellySim } = trpc.mlb.simulateKelly.useQuery({ bankroll, kellyFraction, edge });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Bankroll</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500 uppercase">Balance</span><DollarSign className="w-4 h-4 text-emerald-400" /></div>
          <p className="text-2xl font-bold text-white">${snapshot?.balance || 0}</p>
          <p className="text-xs text-emerald-400 mt-1">+${snapshot?.totalPnl || 0}</p>
        </div>
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500 uppercase">Open Bets</span><TrendingUp className="w-4 h-4 text-blue-400" /></div>
          <p className="text-2xl font-bold text-white">{snapshot?.openBets || 0}</p>
          <p className="text-xs text-gray-500 mt-1">${snapshot?.exposure || 0} exposure</p>
        </div>
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500 uppercase">Avg Unit</span><PiggyBank className="w-4 h-4 text-yellow-400" /></div>
          <p className="text-2xl font-bold text-white">${snapshot?.avgUnit || 0}</p>
        </div>
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500 uppercase">A-Tier Hit Rate</span><Calculator className="w-4 h-4 text-purple-400" /></div>
          <p className="text-2xl font-bold text-white">62.4%</p>
        </div>
      </div>
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Calculator className="w-4 h-4 text-emerald-400" />Kelly Criterion Calculator</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div><label className="text-xs text-gray-500 mb-1 block">Bankroll ($)</label><input type="number" value={bankroll} onChange={e => setBankroll(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#1a1a1a] rounded-lg px-3 py-2 text-sm text-white" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Kelly Fraction</label><input type="range" min="0.05" max="1" step="0.05" value={kellyFraction} onChange={e => setKellyFraction(Number(e.target.value))} className="w-full" /><span className="text-xs text-gray-500">{(kellyFraction * 100).toFixed(0)}%</span></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Edge (%)</label><input type="number" step="0.01" value={edge} onChange={e => setEdge(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#1a1a1a] rounded-lg px-3 py-2 text-sm text-white" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-500/10 rounded-lg p-4 text-center"><p className="text-xs text-gray-500">Full Kelly</p><p className="text-xl font-bold text-emerald-400">${kellySim?.fullKelly?.toFixed(2) || 0}</p></div>
          <div className="bg-blue-500/10 rounded-lg p-4 text-center"><p className="text-xs text-gray-500">Half Kelly (Recommended)</p><p className="text-xl font-bold text-blue-400">${kellySim?.halfKelly?.toFixed(2) || 0}</p></div>
        </div>
      </div>
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Bet History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-[#1a1a1a]"><th className="pb-2">Date</th><th className="pb-2">Balance</th><th className="pb-2">P&L</th><th className="pb-2">Bets</th></tr></thead>
            <tbody>
              {(history?.history || []).map((h: any, i: number) => (
                <tr key={i} className="border-b border-[#1a1a1a]/50">
                  <td className="py-3 text-white">{h.date}</td>
                  <td className="py-3 font-medium text-white">${h.balance}</td>
                  <td className={cn("py-3", h.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>{h.pnl >= 0 ? "+" : ""}{h.pnl}</td>
                  <td className="py-3 text-gray-500">{h.bets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
