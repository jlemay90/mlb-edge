import { Shield } from "lucide-react";
import { cn } from "../../lib/utils";

const teams = [
  { id: 1, name: "Yankees", abbr: "NYY", wins: 45, losses: 32, woba: 0.342, xfip: 3.78, wrc: 112 },
  { id: 2, name: "Dodgers", abbr: "LAD", wins: 48, losses: 29, woba: 0.355, xfip: 3.45, wrc: 118 },
  { id: 3, name: "Braves", abbr: "ATL", wins: 50, losses: 27, woba: 0.348, xfip: 3.62, wrc: 115 },
];

export default function Teams() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Teams</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map(team => (
          <div key={team.id} className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1a1a1a] rounded-lg flex items-center justify-center"><Shield className="w-5 h-5 text-blue-400" /></div>
                <div><h3 className="font-semibold text-white">{team.name}</h3><p className="text-xs text-gray-500">{team.abbr}</p></div>
              </div>
              <div className="text-right"><p className="font-bold text-white">{team.wins}-{team.losses}</p><p className="text-xs text-gray-500">{((team.wins / (team.wins + team.losses)) * 100).toFixed(1)}% W</p></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1a1a1a] rounded-lg p-2 text-center"><p className="text-xs text-gray-500">wOBA</p><p className={cn("font-semibold", team.woba > 0.34 ? "text-emerald-400" : "text-white")}>{team.woba.toFixed(3)}</p></div>
              <div className="bg-[#1a1a1a] rounded-lg p-2 text-center"><p className="text-xs text-gray-500">xFIP</p><p className={cn("font-semibold", team.xfip < 3.8 ? "text-emerald-400" : "text-orange-400")}>{team.xfip.toFixed(2)}</p></div>
              <div className="bg-[#1a1a1a] rounded-lg p-2 text-center"><p className="text-xs text-gray-500">wRC+</p><p className={cn("font-semibold", team.wrc > 110 ? "text-emerald-400" : "text-white")}>{team.wrc}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
