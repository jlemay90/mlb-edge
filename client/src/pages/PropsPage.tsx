import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { RequireTier } from "@/components/RequireTier";
import { Users, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PROP_LABELS: Record<string, string> = {
  pitcher_strikeouts: "Pitcher Strikeouts",
  batter_hits: "Batter Hits",
  batter_home_runs: "Batter Home Runs",
  batter_rbis: "Batter RBIs",
  batter_stolen_bases: "Stolen Bases",
  batter_total_bases: "Total Bases",
  pitcher_hits_allowed: "Hits Allowed",
  pitcher_walks: "Pitcher Walks",
  pitcher_earned_runs: "Earned Runs",
  pitcher_outs: "Pitcher Outs",
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wider",
      tier === "A" && "tier-a", tier === "B" && "tier-b", tier === "C" && "tier-c", tier === "D" && "tier-d"
    )}>{tier}</span>
  );
}

function PropCard({ prop }: { prop: any }) {
  const isOver = prop.pick === "over";
  const edgePct = Math.round((prop.edgeScore || 0) * 100);

  return (
    <div className="pick-card bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-foreground">{prop.playerName}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {prop.awayTeam?.split(" ").pop()} @ {prop.homeTeam?.split(" ").pop()}
          </div>
        </div>
        <TierBadge tier={prop.confidenceTier} />
      </div>

      {/* Prop type */}
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {PROP_LABELS[prop.propType] || prop.propType}
      </div>

      {/* Pick */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOver ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )}
          <span className={cn("text-base font-bold", isOver ? "text-green-400" : "text-red-400")}>
            {isOver ? "OVER" : "UNDER"} {prop.line}
          </span>
        </div>
        <span className={cn("text-sm font-bold tabular-nums",
          edgePct >= 8 ? "text-green-400" : edgePct >= 5 ? "text-cyan-400" : "text-yellow-400"
        )}>
          +{edgePct}%
        </span>
      </div>

      {/* Projection vs line */}
      <div className="bg-secondary/30 rounded-lg px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Model Projection</span>
        <span className="text-sm font-bold text-foreground">{prop.modelProjection?.toFixed(1)}</span>
      </div>

      {/* Odds */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Over: <span className="font-medium text-foreground">{prop.overOdds > 0 ? "+" : ""}{prop.overOdds}</span></span>
        <span>Under: <span className="font-medium text-foreground">{prop.underOdds > 0 ? "+" : ""}{prop.underOdds}</span></span>
      </div>

      {/* Key factors */}
      {prop.keyFactors?.length > 0 && (
        <div className="space-y-1 border-t border-border pt-2">
          {prop.keyFactors.slice(0, 2).map((factor: string, i: number) => (
            <div key={i} className="text-xs text-muted-foreground flex items-start gap-1">
              <span className="text-primary mt-0.5">•</span>
              {factor}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PropsPage() {
  const { data: props, isLoading, refetch } = trpc.mlb.getPlayerProps.useQuery();

  const pitcherProps = props?.filter((p: any) => p.propType?.startsWith("pitcher")) || [];
  const batterProps = props?.filter((p: any) => p.propType?.startsWith("batter")) || [];

  return (
    <AppLayout>
      <RequireTier tier="pro" featureName="Player props">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Player Props</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Model projections vs book lines — picks with positive edge only
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : !props?.length ? (
          <div className="bg-card border border-border rounded-xl p-16 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No prop picks available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Player prop markets may not be open yet for today's games.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {pitcherProps.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  Pitcher Props ({pitcherProps.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pitcherProps.map((prop: any, i: number) => (
                    <PropCard key={`${prop.eventId}-${prop.propType}-${prop.playerName}-${i}`} prop={prop} />
                  ))}
                </div>
              </div>
            )}

            {batterProps.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                  Batter Props ({batterProps.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {batterProps.map((prop: any, i: number) => (
                    <PropCard key={`${prop.eventId}-${prop.propType}-${prop.playerName}-${i}`} prop={prop} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </RequireTier>
    </AppLayout>
  );
}
