import { Gift, ArrowRight, CheckCircle, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export default function FreePick() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <Gift className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">Free Pick of the Day</h1>
        <p className="text-gray-500">One A-grade prediction, fully analyzed, every day.</p>
      </div>
      <div className="bg-[#111111] border border-emerald-500/20 rounded-xl p-6 bg-gradient-to-br from-emerald-500/5 to-transparent">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-emerald-400" />
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">A Grade</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">+12% Edge</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Yankees Moneyline vs Red Sox</h2>
        <p className="text-sm text-gray-400 mb-4">The model gives the Yankees a 68% chance to win, but the market is pricing them at -150 (60% implied). That's an 8% edge in our favor.</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-[#1a1a1a] rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Model Prob</p><p className="text-lg font-bold text-emerald-400">68%</p></div>
          <div className="bg-[#1a1a1a] rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Implied Prob</p><p className="text-lg font-bold text-blue-400">60%</p></div>
          <div className="bg-[#1a1a1a] rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Edge</p><p className="text-lg font-bold text-emerald-400">+8%</p></div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400"><CheckCircle className="w-4 h-4 text-emerald-400" /><span>Model trained on 25+ features including Statcast, weather, and umpire data</span></div>
      </div>
      <div className="text-center">
        <Link to="/mlb" className="inline-flex items-center gap-2 bg-emerald-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-emerald-400 transition-colors">Get All Picks<ArrowRight className="w-4 h-4" /></Link>
        <p className="text-xs text-gray-500 mt-3">No signup required. All predictions are free.</p>
      </div>
    </div>
  );
}
