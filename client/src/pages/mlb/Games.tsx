import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../../main";
import { Filter, ArrowUpDown, Cloud, Sun, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export default function Games() {
  const [selectedTier, setSelectedTier] = useState("All");
  const today = new Date().toISOString().split("T")[0];
  const { data: schedule, isLoading } = trpc.mlb.getSchedule.useQuery({ date: today });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-white">Today's Games</h1><span className="text-sm text-gray-500">{(schedule?.games || []).length} games</span></div>
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-[#111111] border border-[#1a1a1a] rounded-lg px-3 py-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select value={selectedTier} onChange={e => setSelectedTier(e.target.value)} className="bg-transparent text-sm text-white outline-none">
            {["All", "A", "B", "C", "D"].map(t => <option key={t} value={t}>{t === "All" ? "All Tiers" : `${t} Grade`}</option>)}
          </select>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(schedule?.games || []).map((game: any) => (
            <Link key={game.gamePk} to={`/mlb/games/${game.gamePk}`} className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4 block hover:border-emerald-500/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {game.weatherCondition?.toLowerCase().includes("sun") ? <Sun className="w-4 h-4 text-yellow-400" /> : <Cloud className="w-4 h-4 text-gray-500" />}
                  <span>{game.weatherTemp}°F</span><span>•</span><span>Wind {game.windSpeed} mph</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2"><span className="font-semibold text-white">{game.awayTeamName}</span></div>
                  <div className="flex items-center justify-between"><span className="font-semibold text-white">{game.homeTeamName}</span></div>
                </div>
                {game.homeOdds && <div className="text-right ml-4"><p className="text-sm font-semibold text-emerald-400">{game.homeOdds > 0 ? "+" : ""}{game.homeOdds}</p></div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
