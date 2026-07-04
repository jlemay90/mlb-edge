import { useParams, Link } from "react-router-dom";
import { trpc } from "../../main";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { cn } from "../../lib/utils";

function FeatureBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min((Math.abs(value) / 1) * 100, 100);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 text-xs text-gray-500 truncate">{label}</span>
      <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden"><div className={cn("h-full rounded-full", value >= 0 ? "bg-emerald-500" : "bg-red-500")} style={{ width: `${pct}%` }} /></div>
      <span className="w-12 text-right text-xs font-mono text-white">{value.toFixed(3)}</span>
    </div>
  );
}

export default function GameDetail() {
  const { gamePk } = useParams<{ gamePk: string }>();
  const pk = Number(gamePk);
  const { data: game } = trpc.mlb.getGameById.useQuery({ gamePk: pk });
  const { data: context } = trpc.mlb.getGameContext.useQuery({ gamePk: pk });
  const { data: predictions } = trpc.mlb.getPredictionsByGame.useQuery({ gamePk: pk });

  return (
    <div className="space-y-6">
      <Link to="/mlb/games" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" />Back to Games</Link>
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div><h1 className="text-2xl font-bold text-white">{game?.homeTeamName || "Home"} vs {game?.awayTeamName || "Away"}</h1><p className="text-sm text-gray-500 mt-1">{game?.venueName || "Stadium"}</p></div>
          <div className="text-right text-sm text-gray-500"><span>{game?.weatherTemp}°F • {game?.weatherCondition}</span></div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(predictions?.predictions || []).map((pred: any) => (
          <div key={pred.id} className={cn("bg-[#111111] border-l-4 rounded-xl p-4", pred.confidenceTier === "A" ? "border-l-emerald-500" : pred.confidenceTier === "B" ? "border-l-blue-500" : "border-l-gray-500")}>
            <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500 uppercase">{pred.market}</span><span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold", pred.confidenceTier === "A" ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-500/15 text-gray-400")}>{pred.confidenceTier} Grade</span></div>
            <p className="text-2xl font-bold text-white">{(pred.predictedProb * 100).toFixed(0)}%</p>
            <p className="text-sm text-gray-500">{pred.side} wins</p>
            {pred.edge && <p className="text-xs text-emerald-400 mt-2">+{(pred.edge * 100).toFixed(0)}% edge</p>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-400" />Top Model Features</h3>
          <div className="space-y-3">
            <FeatureBar label="Home wOBA (30d)" value={0.342} />
            <FeatureBar label="Away xFIP" value={-0.06} />
            <FeatureBar label="Park Factor Runs" value={0.08} />
            <FeatureBar label="Bullpen ERA (7d)" value={0.03} />
            <FeatureBar label="Umpire Runs/G" value={0.02} />
          </div>
        </div>
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Game Context</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Park Factor (Runs)</span><span className={context?.parkFactor?.runs > 1 ? "text-emerald-400" : "text-blue-400"}>{context?.parkFactor?.runs?.toFixed(2)}x</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Umpire K%</span><span className="text-white">{(context?.umpire?.kRate * 100).toFixed(1)}%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Home Bullpen (7d ERA)</span><span className={context?.bullpen?.home?.era < 4 ? "text-emerald-400" : "text-orange-400"}>{context?.bullpen?.home?.era?.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Rest Days</span><span className="text-white">Home: {context?.restDays?.home} | Away: {context?.restDays?.away}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
