import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Search, Trophy, Target, Zap } from "lucide-react";
import { RequireTier } from "@/components/RequireTier";

type SortKey = "winPct" | "runsPerGame" | "era" | "fip" | "wrcPlus" | "ops" | "whip";

const STAT_LABELS: Record<string, string> = {
  winPct: "Win %",
  runsPerGame: "R/G",
  era: "ERA",
  fip: "FIP",
  xfip: "xFIP",
  wrcPlus: "wRC+",
  ops: "OPS",
  obp: "OBP",
  slg: "SLG",
  avg: "AVG",
  iso: "ISO",
  babip: "BABIP",
  kPct: "K%",
  bbPct: "BB%",
  hrPerGame: "HR/G",
  whip: "WHIP",
  kPer9: "K/9",
  bbPer9: "BB/9",
  hrPer9: "HR/9",
};

function StatBar({ value, max, min, ascending = false }: { value: number; max: number; min: number; ascending?: boolean }) {
  const pct = max === min ? 50 : ((value - min) / (max - min)) * 100;
  const good = ascending ? pct < 30 : pct > 70;
  const bad = ascending ? pct > 70 : pct < 30;
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${good ? "bg-green-500" : bad ? "bg-red-500" : "bg-yellow-500"}`}
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </div>
  );
}

function StreakBadge({ streak }: { streak: string }) {
  if (!streak || streak === "—") return <span className="text-muted-foreground text-xs">—</span>;
  const isWin = streak.startsWith("W");
  return (
    <Badge variant="outline" className={`text-xs font-bold ${isWin ? "border-green-500 text-green-400" : "border-red-500 text-red-400"}`}>
      {streak}
    </Badge>
  );
}

function RankBadge({ rank, total = 30 }: { rank?: number; total?: number }) {
  if (!rank) return null;
  const isTop = rank <= 10;
  const isBot = rank >= 21;
  return (
    <span className={`text-xs font-semibold ml-1 ${isTop ? "text-green-400" : isBot ? "text-red-400" : "text-yellow-400"}`}>
      #{rank}
    </span>
  );
}

export default function TeamsPage() {
  const [sortBy, setSortBy] = useState<SortKey>("winPct");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("standings");
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);

  const { data, isLoading } = trpc.mlb.getTeamExplorer.useQuery(
    { sortBy, league: "all" },
    { staleTime: 5 * 60 * 1000 }
  );

  const teams = data?.teams || [];
  const rankings = data?.rankings || {} as Record<string, Record<number, number>>;

  const filtered = useMemo(() => {
    if (!search) return teams;
    const q = search.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q));
  }, [teams, search]);

  const selected = useMemo(() => teams.find((t) => t.teamId === selectedTeam) || null, [teams, selectedTeam]);

  // Chart data for top 10 by selected stat
  const chartData = useMemo(() => {
    return [...teams]
      .sort((a, b) => {
        const av = (a as any)[sortBy] ?? 0;
        const bv = (b as any)[sortBy] ?? 0;
        const asc = ["era", "fip", "whip"].includes(sortBy);
        return asc ? av - bv : bv - av;
      })
      .slice(0, 10)
      .map((t) => ({ name: t.abbreviation, value: (t as any)[sortBy] ?? 0 }));
  }, [teams, sortBy]);

  const statMin = useMemo(() => Math.min(...teams.map((t) => (t as any)[sortBy] ?? 0)), [teams, sortBy]);
  const statMax = useMemo(() => Math.max(...teams.map((t) => (t as any)[sortBy] ?? 0)), [teams, sortBy]);

  return (
    <AppLayout>
      <RequireTier tier="pro" featureName="Team stats explorer">
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team Stats Explorer</h1>
            <p className="text-muted-foreground text-sm mt-1">
              2026 season — advanced metrics, splits, park factors, and live standings
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-48 bg-muted border-border"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-36 bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="winPct">Win %</SelectItem>
                <SelectItem value="runsPerGame">Runs/Game</SelectItem>
                <SelectItem value="wrcPlus">wRC+</SelectItem>
                <SelectItem value="ops">OPS</SelectItem>
                <SelectItem value="era">ERA</SelectItem>
                <SelectItem value="fip">FIP</SelectItem>
                <SelectItem value="whip">WHIP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted">
            <TabsTrigger value="standings">Standings</TabsTrigger>
            <TabsTrigger value="offense">Offense</TabsTrigger>
            <TabsTrigger value="pitching">Pitching</TabsTrigger>
            <TabsTrigger value="splits">Splits</TabsTrigger>
            <TabsTrigger value="chart">League Chart</TabsTrigger>
          </TabsList>

          {/* ─── STANDINGS ─── */}
          <TabsContent value="standings" className="mt-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Team</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">W</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">L</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">Win%</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">GB</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">L10</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">Streak</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">R/G</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">ERA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((team, i) => (
                      <tr
                        key={team.teamId}
                        onClick={() => { setSelectedTeam(team.teamId); setTab("offense"); }}
                        className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/40 ${selectedTeam === team.teamId ? "bg-primary/10" : ""}`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs w-5 text-right">{i + 1}</span>
                            <div>
                              <div className="font-semibold text-foreground">{team.abbreviation}</div>
                              <div className="text-xs text-muted-foreground">{team.division}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-center px-3 py-2.5 font-semibold text-green-400">{team.wins}</td>
                        <td className="text-center px-3 py-2.5 font-semibold text-red-400">{team.losses}</td>
                        <td className="text-center px-3 py-2.5 font-bold text-foreground">{team.winPct.toFixed(3)}</td>
                        <td className="text-center px-3 py-2.5 text-muted-foreground">{team.gb}</td>
                        <td className="text-center px-3 py-2.5 text-muted-foreground">{team.lastTenW}-{team.lastTenL}</td>
                        <td className="text-center px-3 py-2.5"><StreakBadge streak={team.streak} /></td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.runsPerGame?.toFixed(1) ?? "—"}</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.era?.toFixed(2) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ─── OFFENSE ─── */}
          <TabsContent value="offense" className="mt-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Team</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">R/G <span className="text-xs opacity-60">#</span></th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">wRC+</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">OPS</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">AVG</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">OBP</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">SLG</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">ISO</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">BABIP</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">K%</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">BB%</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">HR/G</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filtered].sort((a, b) => (b.runsPerGame ?? 0) - (a.runsPerGame ?? 0)).map((team) => (
                      <tr key={team.teamId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5">
                          <span className="font-bold text-foreground">{team.abbreviation}</span>
                          <span className="text-xs text-muted-foreground ml-1">{team.wins}-{team.losses}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className="font-semibold text-foreground">{team.runsPerGame?.toFixed(1)}</span>
                          <RankBadge rank={(rankings as any).runsPerGame?.[team.teamId]} />
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-semibold ${(team.wrcPlus ?? 100) >= 110 ? "text-green-400" : (team.wrcPlus ?? 100) <= 95 ? "text-red-400" : "text-foreground"}`}>
                            {team.wrcPlus?.toFixed(0)}
                          </span>
                        </td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.ops?.toFixed(3)}</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.avg?.toFixed(3)}</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.obp?.toFixed(3)}</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.slg?.toFixed(3)}</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.iso?.toFixed(3)}</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.babip?.toFixed(3)}</td>
                        <td className="text-center px-3 py-2.5 text-muted-foreground">{team.kPct?.toFixed(1)}%</td>
                        <td className="text-center px-3 py-2.5 text-muted-foreground">{team.bbPct?.toFixed(1)}%</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.hrPerGame?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ─── PITCHING ─── */}
          <TabsContent value="pitching" className="mt-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Team</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">ERA</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">FIP</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">xFIP</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">WHIP</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">K/9</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">BB/9</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">HR/9</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">ERA Home</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">ERA Away</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filtered].sort((a, b) => (a.era ?? 9) - (b.era ?? 9)).map((team) => (
                      <tr key={team.teamId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5">
                          <span className="font-bold text-foreground">{team.abbreviation}</span>
                          <span className="text-xs text-muted-foreground ml-1">{team.wins}-{team.losses}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-semibold ${(team.era ?? 5) <= 3.7 ? "text-green-400" : (team.era ?? 5) >= 4.5 ? "text-red-400" : "text-foreground"}`}>
                            {team.era?.toFixed(2)}
                          </span>
                          <RankBadge rank={(rankings as any).era?.[team.teamId]} />
                        </td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.fip?.toFixed(2)}</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.xfip?.toFixed(2)}</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.whip?.toFixed(2)}</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.kPer9?.toFixed(1)}</td>
                        <td className="text-center px-3 py-2.5 text-muted-foreground">{team.bbPer9?.toFixed(1)}</td>
                        <td className="text-center px-3 py-2.5 text-muted-foreground">{team.hrPer9?.toFixed(2)}</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.eraHome?.toFixed(2)}</td>
                        <td className="text-center px-3 py-2.5 text-foreground">{team.eraAway?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ─── SPLITS ─── */}
          <TabsContent value="splits" className="mt-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Home/Away run scoring splits and handedness splits for every team. Click a row to see full detail.</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Team</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">R/G Home</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">R/G Away</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">Home Diff</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">vs LHP</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">vs RHP</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">Hand Diff</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">Park Runs</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">Park HR</th>
                        <th className="text-center px-3 py-2 text-muted-foreground font-medium">Surface</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...filtered].sort((a, b) => (b.runsPerGame ?? 0) - (a.runsPerGame ?? 0)).map((team) => {
                        const homeDiff = (team.runsPerGameHome ?? 0) - (team.runsPerGameAway ?? 0);
                        const handDiff = (team.runsPerGameVsR ?? 0) - (team.runsPerGameVsL ?? 0);
                        return (
                          <tr key={team.teamId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-foreground">{team.abbreviation}</td>
                            <td className="text-center px-3 py-2.5 text-foreground">{team.runsPerGameHome?.toFixed(1)}</td>
                            <td className="text-center px-3 py-2.5 text-foreground">{team.runsPerGameAway?.toFixed(1)}</td>
                            <td className="text-center px-3 py-2.5">
                              <span className={homeDiff > 0.3 ? "text-green-400 font-semibold" : homeDiff < -0.3 ? "text-red-400 font-semibold" : "text-muted-foreground"}>
                                {homeDiff > 0 ? "+" : ""}{homeDiff.toFixed(1)}
                              </span>
                            </td>
                            <td className="text-center px-3 py-2.5 text-foreground">{team.runsPerGameVsL?.toFixed(1)}</td>
                            <td className="text-center px-3 py-2.5 text-foreground">{team.runsPerGameVsR?.toFixed(1)}</td>
                            <td className="text-center px-3 py-2.5">
                              <span className={Math.abs(handDiff) > 0.3 ? "text-yellow-400 font-semibold" : "text-muted-foreground"}>
                                {handDiff > 0 ? "+" : ""}{handDiff.toFixed(1)}
                              </span>
                            </td>
                            <td className="text-center px-3 py-2.5">
                              <span className={`font-semibold ${(team.parkFactorRuns ?? 100) >= 104 ? "text-red-400" : (team.parkFactorRuns ?? 100) <= 96 ? "text-green-400" : "text-foreground"}`}>
                                {team.parkFactorRuns ?? 100}
                              </span>
                            </td>
                            <td className="text-center px-3 py-2.5">
                              <span className={`font-semibold ${(team.parkFactorHR ?? 100) >= 106 ? "text-red-400" : (team.parkFactorHR ?? 100) <= 94 ? "text-green-400" : "text-foreground"}`}>
                                {team.parkFactorHR ?? 100}
                              </span>
                            </td>
                            <td className="text-center px-3 py-2.5">
                              <Badge variant="outline" className={`text-xs ${team.surface === "artificial" ? "border-blue-500 text-blue-400" : "border-green-600 text-green-500"}`}>
                                {team.surface === "artificial" ? "Turf" : "Grass"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── CHART ─── */}
          <TabsContent value="chart" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">
                  Top 10 Teams — {STAT_LABELS[sortBy] || sortBy}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        itemStyle={{ color: "hsl(var(--primary))" }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "hsl(var(--primary))" : i < 3 ? "hsl(142 71% 45%)" : "hsl(var(--muted-foreground))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Sorted by {STAT_LABELS[sortBy]} — {["era", "fip", "whip"].includes(sortBy) ? "lower is better" : "higher is better"}
                </p>
              </CardContent>
            </Card>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {[
                { label: "Best Offense", stat: "runsPerGame", icon: <TrendingUp className="h-4 w-4 text-green-400" /> },
                { label: "Best ERA", stat: "era", icon: <Target className="h-4 w-4 text-blue-400" />, asc: true },
                { label: "Best wRC+", stat: "wrcPlus", icon: <Zap className="h-4 w-4 text-yellow-400" /> },
                { label: "Best FIP", stat: "fip", icon: <Trophy className="h-4 w-4 text-purple-400" />, asc: true },
              ].map(({ label, stat, icon, asc }) => {
                const best = [...teams].sort((a, b) => {
                  const av = (a as any)[stat] ?? (asc ? 99 : 0);
                  const bv = (b as any)[stat] ?? (asc ? 99 : 0);
                  return asc ? av - bv : bv - av;
                })[0];
                return (
                  <Card key={stat} className="bg-muted/30 border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
                      <div className="font-bold text-foreground">{best?.abbreviation}</div>
                      <div className="text-xs text-muted-foreground">{((best as any)?.[stat] ?? 0).toFixed(stat === "wrcPlus" ? 0 : 2)}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      </RequireTier>
    </AppLayout>
  );
}
