import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import MLBApp from "./MLBApp";
import ClaudeChat from "./components/mlb/ClaudeChat";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/mlb/*" element={<MLBApp />} />
      </Routes>
      <ClaudeChat />
    </>
  );
}
