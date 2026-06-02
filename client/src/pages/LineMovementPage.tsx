import { useState, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Activity } from "lucide-react";
import { RequireTier } from "@/components/RequireTier";
import { format, parseISO } from "date-fns";

function americanToImplied(odds: number): number {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

function formatOdds(odds: number | null | undefined): string {
  if (odds == null) return "—";
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function MovementBadge({ diff }: { diff: number }) {
  if (Math.abs(diff) < 2) return <Badge variant="outline" className="text-xs text-muted-foreground">Flat</Badge>;
  if (diff > 0) return <Badge className="text-xs bg-green-600 text-white">+{diff} pts ↑</Badge>;
  return <Badge className="text-xs bg-red-600 text-white">{diff} pts ↓</Badge>;
}

function SharpSignalCard({ signal }: { signal: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
      <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
      <span className="text-sm text-yellow-300">{signal}</span>
    </div>
  );
}

export default function LineMovementPage() {
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);

  const { data: gamesData, isLoading: gamesLoading, refetch: refetchGames } = trpc.mlb.getTodaysGames.useQuery(
    {},
    { staleTime: 2 * 60 * 1000 }
  );

  type GameItem = NonNullable<typeof gamesData>[number];
  const games: GameItem[] = gamesData || [];

  // Auto-select first game
  useEffect(() => {
    if (games.length > 0 && !selectedGamePk) {
      setSelectedGamePk(games[0].gamePk);
    }
  }, [games, selectedGamePk]);

  const { data: movementData, isLoading: movementLoading, refetch: refetchMovement } = trpc.mlb.getLineMovement.useQuery(
    { gamePk: selectedGamePk! },
    { enabled: !!selectedGamePk, staleTime: 60 * 1000 }
  );

  const snapshotMutation = trpc.mlb.snapshotOdds.useMutation({
    onSuccess: () => {
      refetchMovement();
      setSnapshotting(false);
    },
    onError: () => setSnapshotting(false),
  });

  const selectedGame = useMemo(() => games.find((g) => g.gamePk === selectedGamePk), [games, selectedGamePk]);

  // Snapshot current odds when game is selected
  useEffect(() => {
    if (!selectedGame || !selectedGamePk) return;
    const odds = selectedGame.odds;
    if (!odds?.homeMoneyLine && !odds?.awayMoneyLine) return;
    setSnapshotting(true);
    snapshotMutation.mutate({
      gamePk: selectedGamePk,
      bookmaker: "consensus",
      homePrice: odds.homeMoneyLine,
      awayPrice: odds.awayMoneyLine,
      total: odds.total,
      overPrice: odds.overPrice,
      underPrice: odds.underPrice,
      market: "h2h",
    });
  }, [selectedGamePk]);

  const snapshots = movementData?.snapshots || [];
  const summary = movementData?.summary || null;

  // Build chart data from snapshots
  const mlChartData = useMemo(() => {
    return snapshots
      .filter((s) => s.market === "h2h")
      .map((s) => ({
        time: format(new Date(s.snapshotAt), "h:mm a"),
        home: s.homePrice,
        away: s.awayPrice,
        homeImpl: s.homePrice ? Math.round(americanToImplied(s.homePrice) * 100) : null,
        awayImpl: s.awayPrice ? Math.round(americanToImplied(s.awayPrice) * 100) : null,
      }));
  }, [snapshots]);

  const totalChartData = useMemo(() => {
    return snapshots
      .filter((s) => s.market === "h2h" && s.total != null)
      .map((s) => ({
        time: format(new Date(s.snapshotAt), "h:mm a"),
        total: s.total,
        overPrice: s.overPrice,
        underPrice: s.underPrice,
      }));
  }, [snapshots]);

  return (
    <AppLayout>
      <RequireTier tier="pro" featureName="Line movement tracking">
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Line Movement</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track how odds shift from open to current — spot sharp money, steam moves, and reverse line movement
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchGames(); if (selectedGamePk) refetchMovement(); }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game selector */}
          <div className="lg:col-span-1 space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Today's Games</h2>
            {gamesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {games.map((game) => {
                  // ml is unused — odds accessed directly below
                  const isSelected = game.gamePk === selectedGamePk;
                  return (
                    <button
                      key={game.gamePk}
                      onClick={() => setSelectedGamePk(game.gamePk)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm text-foreground">
                            {game.awayTeam.name} @ {game.homeTeam.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{format(parseISO(game.gameTime), 'h:mm a')}</div>
                        </div>
                        {game.odds && (
                          <div className="text-right text-xs">
                            <div className="text-muted-foreground">{formatOdds(game.odds.awayMoneyLine)}</div>
                            <div className="text-muted-foreground">{formatOdds(game.odds.homeMoneyLine)}</div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Movement detail */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedGame ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                Select a game to view line movement
              </div>
            ) : (
              <>
                {/* Game header */}
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-foreground">
                          {selectedGame.awayTeam.name} @ {selectedGame.homeTeam.name}
                        </h2>
                        <p className="text-sm text-muted-foreground">{selectedGame.venue} · {format(parseISO(selectedGame.gameTime), 'h:mm a z')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground">{snapshots.length} snapshots</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Sharp signals */}
                {summary?.sharpSignals && summary.sharpSignals.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Sharp Money Signals
                    </h3>
                    {summary.sharpSignals.map((signal, i) => (
                      <SharpSignalCard key={i} signal={signal} />
                    ))}
                  </div>
                )}

                {/* Open vs Current summary */}
                {summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      {
                        label: `${selectedGame.homeTeam.name} ML`,
                        open: summary.openHomeML,
                        current: summary.currentHomeML,
                        diff: (summary.currentHomeML ?? 0) - (summary.openHomeML ?? 0),
                      },
                      {
                        label: `${selectedGame.awayTeam.name} ML`,
                        open: summary.openAwayML,
                        current: summary.currentAwayML,
                        diff: (summary.currentAwayML ?? 0) - (summary.openAwayML ?? 0),
                      },
                      {
                        label: "Total",
                        open: summary.openTotal,
                        current: summary.currentTotal,
                        diff: (summary.currentTotal ?? 0) - (summary.openTotal ?? 0),
                        isTotal: true,
                      },
                      {
                        label: "Over Price",
                        open: summary.openOverPrice,
                        current: summary.currentOverPrice,
                        diff: (summary.currentOverPrice ?? 0) - (summary.openOverPrice ?? 0),
                      },
                    ].map(({ label, open, current, diff, isTotal }) => (
                      <Card key={label} className="bg-muted/30 border-border">
                        <CardContent className="p-3">
                          <div className="text-xs text-muted-foreground mb-1">{label}</div>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs text-muted-foreground">Open</div>
                              <div className="font-semibold text-foreground text-sm">
                                {isTotal ? (open?.toFixed(1) ?? "—") : formatOdds(open)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Now</div>
                              <div className="font-bold text-foreground text-sm">
                                {isTotal ? (current?.toFixed(1) ?? "—") : formatOdds(current)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2">
                            <MovementBadge diff={diff} />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Money line chart */}
                {movementLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : mlChartData.length > 1 ? (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Money Line Movement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={mlChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                            formatter={(value: any, name: string) => [
                              name === "home" || name === "away" ? formatOdds(value) : `${value}%`,
                              name === "home" ? selectedGame.homeTeam.name : name === "away" ? selectedGame.awayTeam.name : name,
                            ]}
                          />
                          <ReferenceLine y={0} stroke="hsl(var(--border))" />
                          <Line type="monotone" dataKey="home" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="home" />
                          <Line type="monotone" dataKey="away" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} name="away" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-card border-border">
                    <CardContent className="p-6 text-center">
                      <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Line movement tracking has started for this game.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        The chart will populate as odds snapshots are collected over time. Check back closer to game time for movement data.
                      </p>
                      {/* Show current odds as a static snapshot */}
                      {selectedGame.odds?.homeMoneyLine && (
                        <div className="mt-4 grid grid-cols-2 gap-3 max-w-xs mx-auto">
                          <div className="bg-muted/30 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground">{selectedGame.awayTeam.name}</div>
                            <div className="font-bold text-lg text-foreground">{formatOdds(selectedGame.odds.awayMoneyLine)}</div>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground">{selectedGame.homeTeam.name}</div>
                            <div className="font-bold text-lg text-foreground">{formatOdds(selectedGame.odds.homeMoneyLine)}</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Total chart */}
                {totalChartData.length > 1 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total Line Movement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={totalChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                          <YAxis domain={["auto", "auto"]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                          />
                          <Line type="monotone" dataKey="total" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} name="Total" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Line movement explainer */}
                <Card className="bg-muted/20 border-border/50">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">How to Read Line Movement</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
                      <div>
                        <div className="text-yellow-400 font-semibold mb-1">Steam Move</div>
                        Rapid line movement (10+ points) in a short window — sharp bettors hit multiple books simultaneously. Follow the steam.
                      </div>
                      <div>
                        <div className="text-green-400 font-semibold mb-1">Reverse Line Movement</div>
                        Public bets heavily on one side but line moves the other way — books are respecting sharp money on the opposite side.
                      </div>
                      <div>
                        <div className="text-blue-400 font-semibold mb-1">Total Movement</div>
                        Total moving up = sharp over action. Total moving down = sharp under action. Watch for 0.5+ point moves.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
      </RequireTier>
    </AppLayout>
  );
}
