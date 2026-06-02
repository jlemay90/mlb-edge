import { useAccount } from "@/hooks/useAccount";
import Dashboard from "./Dashboard";
import LandingPage from "./LandingPage";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";

/**
 * Root route controller:
 * - Authenticated users see the live Dashboard (the product).
 * - Logged-out visitors see the public LandingPage (the sales pitch).
 * This ensures Facebook traffic lands on conversion-focused marketing, not the free app.
 */
export default function HomeGate() {
  const { loading, isAuthenticated } = useAccount();

  if (loading) return <DashboardLayoutSkeleton />;
  return isAuthenticated ? <Dashboard /> : <LandingPage />;
}
