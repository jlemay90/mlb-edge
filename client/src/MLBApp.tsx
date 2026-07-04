import { Routes, Route } from "react-router-dom";
import Layout from "./components/mlb/Layout";
import Dashboard from "./pages/mlb/Dashboard";
import Games from "./pages/mlb/Games";
import GameDetail from "./pages/mlb/GameDetail";
import Analytics from "./pages/mlb/Analytics";
import Props from "./pages/mlb/Props";
import Parlays from "./pages/mlb/Parlays";
import Lines from "./pages/mlb/Lines";
import Teams from "./pages/mlb/Teams";
import Bankroll from "./pages/mlb/Bankroll";
import FreePick from "./pages/mlb/FreePick";
import NotFound from "./pages/mlb/NotFound";

export default function MLBApp() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/games" element={<Games />} />
        <Route path="/games/:gamePk" element={<GameDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/props" element={<Props />} />
        <Route path="/parlays" element={<Parlays />} />
        <Route path="/lines" element={<Lines />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/bankroll" element={<Bankroll />} />
        <Route path="/free-pick" element={<FreePick />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
