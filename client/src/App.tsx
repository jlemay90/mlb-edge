import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import GamesPage from "./pages/GamesPage";
import PropsPage from "./pages/PropsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import GameDetailPage from "./pages/GameDetailPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/games" component={GamesPage} />
      <Route path="/games/:gamePk" component={GameDetailPage} />
      <Route path="/props" component={PropsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
