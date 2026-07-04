export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-3xl">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-sm text-emerald-400">Live for 2024 Season</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">
          <span className="text-white">MLB</span><span className="text-emerald-400"> Edge</span>
        </h1>
        <p className="text-xl text-gray-400 mb-8 max-w-xl mx-auto">
          AI-powered MLB predictions using ensemble machine learning, live odds, Statcast data, and weather analysis.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <a href="/mlb" className="bg-emerald-500 text-black px-8 py-4 rounded-xl font-bold text-lg hover:bg-emerald-400 transition-colors">Enter Prediction Engine</a>
          <a href="/mlb/free-pick" className="bg-[#111111] border border-[#1a1a1a] text-white px-8 py-4 rounded-xl font-bold text-lg hover:border-emerald-500/30 transition-colors">Free Pick of the Day</a>
        </div>
        <div className="grid grid-cols-3 gap-8 text-center">
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-6">
            <p className="text-3xl font-bold text-emerald-400">62.4%</p>
            <p className="text-sm text-gray-500 mt-1">A-Tier Hit Rate</p>
          </div>
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-6">
            <p className="text-3xl font-bold text-emerald-400">+14.2%</p>
            <p className="text-sm text-gray-500 mt-1">Total ROI</p>
          </div>
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-6">
            <p className="text-3xl font-bold text-emerald-400">25+</p>
            <p className="text-sm text-gray-500 mt-1">Model Features</p>
          </div>
        </div>
      </div>
    </div>
  );
}
