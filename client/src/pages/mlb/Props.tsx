import { useState } from "react";
import { Target, Plus, Minus, AlertTriangle } from "lucide-react";
import { trpc } from "../../main";
import { cn } from "../../lib/utils";

const propTypes = [
  { id: "batter_hr", label: "Batter HR" },
  { id: "batter_hits", label: "Batter Hits" },
  { id: "pitcher_ks", label: "Pitcher K's" },
];

export default function Props() {
  const [selectedType, setSelectedType] = useState("batter_hr");
  const [parlayLegs, setParlayLegs] = useState<string[]>([]);
  const { data: availableProps } = trpc.mlb.getAvailableProps.useQuery({ gamePk: 717401 });

  const toggleLeg = (id: string) => setParlayLegs(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
  const filtered = (availableProps?.props || []).filter((p: any) => p.propType === selectedType);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Player Props</h1>
        {parlayLegs.length > 0 && <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">{parlayLegs.length} in Parlay</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        {propTypes.map(pt => (
          <button key={pt.id} onClick={() => setSelectedType(pt.id)} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", selectedType === pt.id ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-[#111111] border border-[#1a1a1a] text-gray-500 hover:text-white")}>{pt.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((prop: any) => (
          <div key={prop.playerId} className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div><p className="font-semibold text-white">{prop.playerName}</p><p className="text-xs text-gray-500">{prop.team}</p></div>
              <button onClick={() => toggleLeg(`${prop.playerId}-${prop.propType}`)} className={cn("p-2 rounded-lg transition-colors", parlayLegs.includes(`${prop.playerId}-${prop.propType}`) ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1a1a1a] text-gray-500 hover:text-white")}>{parlayLegs.includes(`${prop.playerId}-${prop.propType}`) ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#1a1a1a] rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Over</p><p className="text-lg font-bold text-emerald-400">{prop.overOdds > 0 ? "+" : ""}{prop.overOdds}</p></div>
              <div className="bg-[#1a1a1a] rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Under</p><p className="text-lg font-bold text-blue-400">{prop.underOdds > 0 ? "+" : ""}{prop.underOdds}</p></div>
            </div>
          </div>
        ))}
      </div>
      {parlayLegs.length > 1 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-emerald-400" />Parlay Analysis</h3>
          <div className="flex items-center gap-2 mt-3 text-yellow-400"><AlertTriangle className="w-4 h-4" /><span className="text-xs">Correlation warning: Same team props may be correlated</span></div>
        </div>
      )}
    </div>
  );
}
