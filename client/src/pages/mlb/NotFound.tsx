import { Link } from "react-router-dom";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-6xl font-bold text-emerald-400 mb-4">404</h1>
      <p className="text-xl text-gray-500 mb-6">Page not found</p>
      <Link to="/mlb" className="inline-flex items-center gap-2 bg-emerald-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-emerald-400 transition-colors"><Home className="w-4 h-4" />Back to Dashboard</Link>
    </div>
  );
}
