import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, BarChart3, Target, Layers, TrendingUp, Shield, DollarSign, Gift, Menu, Zap } from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/mlb", label: "Dashboard", icon: LayoutDashboard },
  { to: "/mlb/games", label: "Games", icon: Calendar },
  { to: "/mlb/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/mlb/props", label: "Props", icon: Target },
  { to: "/mlb/parlays", label: "Parlays", icon: Layers },
  { to: "/mlb/lines", label: "Lines", icon: TrendingUp },
  { to: "/mlb/teams", label: "Teams", icon: Shield },
  { to: "/mlb/bankroll", label: "Bankroll", icon: DollarSign },
  { to: "/mlb/free-pick", label: "Free Pick", icon: Gift },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#111111] border-r border-[#1a1a1a] transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-16 flex items-center px-6 border-b border-[#1a1a1a]">
          <Zap className="w-6 h-6 text-emerald-400 mr-2" />
          <span className="text-lg font-bold tracking-tight text-white">MLB Edge</span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>
                <Icon className="w-4 h-4 mr-3" />{item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="flex-1 min-w-0">
        <header className="lg:hidden h-16 flex items-center px-4 border-b border-[#1a1a1a] bg-[#111111]">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2"><Menu className="w-5 h-5 text-white" /></button>
          <span className="ml-3 font-bold text-white">MLB Edge</span>
        </header>
        <main className="p-4 lg:p-6 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
