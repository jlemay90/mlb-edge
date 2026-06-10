import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import HomeGate from "./pages/HomeGate";
import GamesPage from "./pages/GamesPage";
import PropsPage from "./pages/PropsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import GameDetailPage from "./pages/GameDetailPage";
import TeamsPage from "./pages/TeamsPage";
import LineMovementPage from "./pages/LineMovementPage";
import PricingPage from "./pages/PricingPage";
import BillingPage from "./pages/BillingPage";
import LandingPage from "./pages/LandingPage";
import FreePickPage from "./pages/FreePickPage";
import LegalPage from "./pages/LegalPage";
import ParlaysPage from "./pages/ParlaysPage";
import { AgeGate } from "./components/AgeGate";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeGate} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/app" component={Dashboard} />
      <Route path="/games" component={GamesPage} />
      <Route path="/games/:gamePk" component={GameDetailPage} />
      <Route path="/props" component={PropsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/teams" component={TeamsPage} />
      <Route path="/lines" component={LineMovementPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/parlays" component={ParlaysPage} />
      <Route path="/landing" component={LandingPage} />
      <Route path="/free-pick" component={FreePickPage} />
      <Route path="/legal" component={LegalPage} />
      <Route path="/terms" component={LegalPage} />
      <Route path="/privacy" component={LegalPage} />
      <Route path="/refunds" component={LegalPage} />
      <Route path="/responsible-gambling" component={LegalPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AgeGate />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
