import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "../../lib/utils";

const lineMovements = [
  { game: "NYY vs BOS", market: "Moneyline", open: -140, current: -150, move: -10, steam: true },
  { game: "LAD vs SF", market: "Total", open: 8.5, current: 9.0, move: 0.5, steam: false },
];

export default function Lines() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Line Movement</h1>
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-[#1a1a1a]"><th className="pb-3">Game</th><th className="pb-3">Market</th><th className="pb-3">Open</th><th className="pb-3">Current</th><th className="pb-3">Move</th><th className="pb-3">Signal</th></tr></thead>
            <tbody>
              {lineMovements.map((line, i) => (
                <tr key={i} className="border-b border-[#1a1a1a]/50">
                  <td className="py-3 font-medium text-white">{line.game}</td>
                  <td className="py-3 text-white">{line.market}</td>
                  <td className="py-3 text-gray-500">{line.open > 0 ? "+" : ""}{line.open}</td>
                  <td className="py-3 font-semibold text-white">{line.current > 0 ? "+" : ""}{line.current}</td>
                  <td className="py-3"><span className={cn("flex items-center gap-1", line.move < 0 ? "text-red-400" : line.move > 0 ? "text-emerald-400" : "text-gray-500")}>{line.move < 0 ? <ArrowDownRight className="w-3 h-3" /> : line.move > 0 ? <ArrowUpRight className="w-3 h-3" /> : null}{line.move !== 0 ? Math.abs(line.move) : "-"}</span></td>
                  <td className="py-3">{line.steam ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-500/15 text-red-400"><TrendingUp className="w-3 h-3" /> Steam</span> : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-500/15 text-gray-400">Normal</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
