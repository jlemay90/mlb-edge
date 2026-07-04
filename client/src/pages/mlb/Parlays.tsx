import { Layers, Zap } from "lucide-react";

export default function Parlays() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Parlays</h1>
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400" />Model-Generated Parlays</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-white">HR Prop Parlay</h3><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-400">B Grade</span></div>
            <p className="text-sm text-gray-500 mb-3">2+ players to hit a home run</p>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-white"><Layers className="w-3 h-3 text-gray-500" /><span>Aaron Judge</span></div>
              <div className="flex items-center gap-2 text-sm text-white"><Layers className="w-3 h-3 text-gray-500" /><span>Shohei Ohtani</span></div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[#1a1a1a] text-sm"><div><span className="text-gray-500">Combined: </span><span className="text-emerald-400 font-semibold">18%</span></div><div><span className="text-gray-500">Fair: </span><span className="text-white font-semibold">+455</span></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
