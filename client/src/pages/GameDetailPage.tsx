import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { Thermometer, Wind, ArrowLeft, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded text-sm font-bold tracking-wider",
      tier === "A" && "tier-a", tier === "B" && "tier-b", tier === "C" && "tier-c", tier === "D" && "tier-d"
    )}>{tier}-Grade</span>
  );
}

function FactorRow({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: "good" | "bad" | "neutral" }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div>
        <div className="text-sm text-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className={cn("text-sm font-semibold tabular-nums",
        highlight === "good" && "text-green-400",
        highlight === "bad" && "text-red-400",
        highlight === "neutral" && "text-foreground",
        !highlight && "text-foreground"
      )}>
        {value}
      </div>
    </div>
  );
}

export default function GameDetailPage() {
  const params = useParams<{ gamePk: string }>();
  const today = new Date().toISOString().split("T")[0];
  const { data: games, isLoading } = trpc.mlb.getTodaysGames.useQuery({ date: today });

  const game = games?.find((g: any) => String(g.gamePk) === params.gamePk);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-secondary rounded w-64" />
            <div className="h-48 bg-secondary rounded-xl" />
            <div className="h-48 bg-secondary rounded-xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!game) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto text-center">
          <p className="text-muted-foreground">Game not found. It may not be in today's schedule.</p>
          <Link href="/games">
            <Button variant="outline" className="mt-4 gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Games
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const { predictions, weather, odds, parkFactor } = game;

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Back */}
        <Link href="/games">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </Button>
        </Link>

        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {game.awayTeam?.name} @ {game.homeTeam?.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                {game.venue} &bull;{" "}
                {game.gameTime
                  ? new Date(game.gameTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
                  : "TBD"}
              </p>
            </div>
            {predictions?.topPick && (
              <TierBadge tier={predictions.topPick.confidenceTier} />
            )}
          </div>

          {/* Pitchers */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Away SP</div>
              <div className="font-semibold text-foreground">{game.awayPitcher || "TBD"}</div>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Home SP</div>
              <div className="font-semibold text-foreground">{game.homePitcher || "TBD"}</div>
            </div>
          </div>
        </div>

        {/* Predictions */}
        {predictions && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" /> Model Predictions
            </h2>

            {/* Projected score */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="text-sm text-muted-foreground mb-3">Projected Score</div>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">{predictions.projectedAwayRuns?.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground mt-1">{game.awayTeam?.abbreviation}</div>
                </div>
                <div className="text-2xl text-muted-foreground font-light">—</div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">{predictions.projectedHomeRuns?.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground mt-1">{game.homeTeam?.abbreviation}</div>
                </div>
              </div>
              <div className="text-center mt-3 text-sm text-muted-foreground">
                Projected Total: <span className="font-bold text-foreground">{predictions.projectedTotal?.toFixed(1)}</span>
                {odds?.total && <span> (Book: {odds.total})</span>}
              </div>
            </div>

            {/* Pick cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[predictions.moneyLine, predictions.runLine, predictions.total].filter(Boolean).map((pick: any) => (
                <div key={pick.market} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{pick.market}</span>
                    <span className={cn("text-sm font-bold",
                      pick.edgeScore >= 0.08 ? "text-green-400" : pick.edgeScore >= 0.05 ? "text-cyan-400" : "text-yellow-400"
                    )}>+{Math.round((pick.edgeScore || 0) * 100)}%</span>
                  </div>
                  <div className="text-sm font-semibold text-foreground">{pick.pickLabel}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model prob</span>
                      <span className="font-medium text-foreground">{Math.round((pick.modelProbability || 0) * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Book implied</span>
                      <span className="font-medium text-muted-foreground">{Math.round((pick.impliedProbability || 0) * 100)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key factors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Weather */}
          {weather && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-blue-400" /> Weather Conditions
              </h3>
              <FactorRow label="Temperature" value={`${weather.tempF}°F`} />
              <FactorRow label="Wind" value={`${weather.windSpeedMph} mph ${weather.windDirLabel}`}
                highlight={weather.windDirLabel?.includes("Out") ? "bad" : "good"} />
              <FactorRow label="Run Impact" value={`${(weather.runImpact ?? 0) > 0 ? "+" : ""}${weather.runImpact ?? 0} runs`}
                highlight={(weather.runImpact ?? 0) > 0.5 ? "bad" : (weather.runImpact ?? 0) < -0.5 ? "good" : "neutral"} />
            </div>
          )}

          {/* Park factors */}
          {parkFactor && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-400" /> Park Factors
              </h3>
              <FactorRow label="Run Factor" value={parkFactor.runs != null ? `${parkFactor.runs} (${parkFactor.runs > 100 ? "+" : ""}${parkFactor.runs - 100}%)` : "—"}
                highlight={(parkFactor.runs ?? 100) > 105 ? "bad" : (parkFactor.runs ?? 100) < 95 ? "good" : "neutral"} />
              <FactorRow label="HR Factor" value={parkFactor.hr != null ? `${parkFactor.hr} (${parkFactor.hr > 100 ? "+" : ""}${parkFactor.hr - 100}%)` : "—"}
                highlight={(parkFactor.hr ?? 100) > 105 ? "bad" : (parkFactor.hr ?? 100) < 95 ? "good" : "neutral"} />
              <FactorRow label="Venue" value={game.venue || "—"} />
            </div>
          )}
        </div>

        {/* Umpire */}
        {game.umpire && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Home Plate Umpire</h3>
            <FactorRow label="Umpire" value={game.umpire} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
