import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Thermometer,
  Wind,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wider",
      tier === "A" && "tier-a", tier === "B" && "tier-b", tier === "C" && "tier-c", tier === "D" && "tier-d"
    )}>{tier}</span>
  );
}

function OddsChip({ label, odds }: { label: string; odds?: number }) {
  if (!odds) return null;
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", odds > 0 ? "text-green-400" : "text-foreground")}>
        {odds > 0 ? "+" : ""}{odds}
      </div>
    </div>
  );
}

function GameCard({ game }: { game: any }) {
  const { predictions, weather, odds, parkFactor } = game;
  const topPick = predictions?.topPick;

  return (
    <Link href={`/games/${game.gamePk}`}>
      <div className="pick-card bg-card border border-border rounded-xl overflow-hidden cursor-pointer">
        {/* Top bar — tier indicator */}
        {topPick && (
          <div className={cn("h-1",
            topPick.confidenceTier === "A" && "bg-green-500",
            topPick.confidenceTier === "B" && "bg-cyan-500",
            topPick.confidenceTier === "C" && "bg-yellow-500",
            topPick.confidenceTier === "D" && "bg-muted"
          )} />
        )}

        <div className="p-4 space-y-4">
          {/* Teams row */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-foreground">
                  {game.awayTeam?.abbreviation}
                </span>
                <span className="text-xs text-muted-foreground">{game.awayTeam?.record}</span>
                <span className="text-muted-foreground text-sm">@</span>
                <span className="text-base font-bold text-foreground">
                  {game.homeTeam?.abbreviation}
                </span>
                <span className="text-xs text-muted-foreground">{game.homeTeam?.record}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {(typeof game.awayPitcher === "object" ? game.awayPitcher?.name : game.awayPitcher) || "TBD"} vs {(typeof game.homePitcher === "object" ? game.homePitcher?.name : game.homePitcher) || "TBD"}
              </div>
            </div>
            <div className="text-right">
              {game.status === "In Progress" ? (
                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                  <span className="live-dot w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  LIVE
                </span>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {game.gameTime ? new Date(game.gameTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "TBD"}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">{game.venue}</div>
            </div>
          </div>

          {/* Odds row */}
          {odds && (
            <div className="flex items-center gap-4 py-2 border-y border-border">
              <OddsChip label={`${game.awayTeam?.abbreviation} ML`} odds={odds.awayMoneyLine} />
              <OddsChip label={`${game.homeTeam?.abbreviation} ML`} odds={odds.homeMoneyLine} />
              <div className="flex-1" />
              {odds.total && (
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-sm font-bold text-foreground">{odds.total}</div>
                </div>
              )}
            </div>
          )}

          {/* Predictions row */}
          {predictions && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Proj Home", value: predictions.projectedHomeRuns?.toFixed(1) },
                { label: "Proj Total", value: predictions.projectedTotal?.toFixed(1) },
                { label: "Proj Away", value: predictions.projectedAwayRuns?.toFixed(1) },
              ].map(({ label, value }) => (
                <div key={label} className="text-center bg-secondary/50 rounded-lg py-2">
                  <div className="text-sm font-bold text-foreground">{value || "—"}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Top pick */}
          {topPick && (
            <div className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <TierBadge tier={topPick.confidenceTier} />
                <span className="text-sm font-medium text-foreground">{topPick.pickLabel}</span>
              </div>
              <span className={cn("text-sm font-bold tabular-nums",
                topPick.edgeScore >= 0.08 ? "text-green-400" : topPick.edgeScore >= 0.05 ? "text-cyan-400" : "text-yellow-400"
              )}>
                +{Math.round((topPick.edgeScore || 0) * 100)}%
              </span>
            </div>
          )}

          {/* Weather & park */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {weather && (
              <>
                <span className="flex items-center gap-1">
                  <Thermometer className="w-3 h-3" />{weather.temp ?? weather.tempF ?? 72}°F
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3" />{weather.windSpeed ?? weather.windSpeedMph ?? 8} mph {weather.windDir ?? weather.windDirLabel ?? ""}
                </span>
                {weather.runImpact !== 0 && (
                  <span className={cn("font-medium", weather.runImpact > 0 ? "text-red-400" : "text-blue-400")}>
                    {weather.runImpact > 0 ? "+" : ""}{weather.runImpact} runs
                  </span>
                )}
              </>
            )}
            {parkFactor && (
              <span className="ml-auto">
                Park: {parkFactor.runs > 100 ? "+" : ""}{parkFactor.runs - 100}% runs
              </span>
            )}
          </div>
        </div>

        <div className="px-4 pb-3 flex items-center justify-end text-xs text-muted-foreground gap-1">
          Full analysis <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

export default function GamesPage() {
  const today = new Date().toISOString().split("T")[0];
  const { data: games, isLoading, refetch } = trpc.mlb.getTodaysGames.useQuery({ date: today });

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Today's Games</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Full slate with ML predictions, odds, weather, and park factors
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : !games?.length ? (
          <div className="bg-card border border-border rounded-xl p-16 text-center">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No games found for today</p>
            <p className="text-sm text-muted-foreground mt-1">
              The MLB schedule may not be loaded yet. Try refreshing.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {games.map((game: any) => (
              <GameCard key={game.gamePk} game={game} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Activity({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
