/**
 * Parlays of the Day — Sharp-tier feature
 * Shows 5 daily parlay types with full reasoning, win/loss tracking, and model feedback log.
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { RequireTier } from "@/components/RequireTier";
import { useAccount } from "@/hooks/useAccount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Trophy,
  Target,
  Zap,
  Flame,
  Home as HomeRun,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart2,
  Info,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type ParlayType = "power" | "value" | "lotto" | "highvalue" | "hrprop";
type ResultType = "pending" | "win" | "loss" | "push";

interface ParlayLegRow {
  id: number;
  parlayCardId: number;
  gamePk: number;
  gameDate: string | Date;
  homeTeam: string | null;
  awayTeam: string | null;
  market: "moneyline" | "runline" | "total" | "prop";
  pick: string;
  pickLabel: string | null;
  odds: number;
  edgeScore: number | null;
  modelProbability: number | null;
  reasoning: string | null;
  result: ResultType | null;
  actualOutcome: string | null;
}

interface ParlayCardRow {
  id: number;
  date: string | Date;
  type: ParlayType;
  legs: unknown;
  combinedOdds: number;
  totalLegs: number;
  reasoning: string | null;
  result: ResultType | null;
  legsWon: number | null;
  legsLost: number | null;
  lossAnalysis: string | null;
  postgameDebrief: string | null;
  generatedAt: number;
  gradedAt: number | null;
  dbLegs: ParlayLegRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PARLAY_META: Record<ParlayType, { label: string; icon: React.ElementType; color: string; description: string }> = {
  power: {
    label: "Power Parlay",
    icon: Zap,
    color: "text-yellow-400",
    description: "5–6 leg high-confidence parlay. All legs independently verified with pitcher matchups, weather, park factors, and umpire tendencies.",
  },
  value: {
    label: "Value Parlay",
    icon: Target,
    color: "text-blue-400",
    description: "3–4 leg parlay combining the sharpest ML/RL/total picks plus the best player prop if edge is strong.",
  },
  lotto: {
    label: "Lotto Pick",
    icon: Flame,
    color: "text-orange-400",
    description: "Max legs, minimum +4000 odds. Swing for the fences — every leg has positive model edge.",
  },
  highvalue: {
    label: "High-Value Play",
    icon: TrendingUp,
    color: "text-green-400",
    description: "1–2 leg play with the strongest risk/reward profile today. Best underdog value or high-edge total.",
  },
  hrprop: {
    label: "HR Prop Parlay",
    icon: HomeRun,
    color: "text-red-400",
    description: "Top 5 home run opportunities based on park factors, wind direction, temperature, and pitcher vulnerability.",
  },
};

const MARKET_LABEL: Record<string, string> = {
  moneyline: "ML",
  runline: "RL",
  total: "Total",
  prop: "Prop",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function impliedProb(odds: number): string {
  const p = odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  return `${(p * 100).toFixed(0)}%`;
}

function ResultBadge({ result }: { result: ResultType | null }) {
  if (!result || result === "pending") {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground border-muted-foreground/30">
        <Clock className="w-3 h-3" /> Pending
      </Badge>
    );
  }
  if (result === "win") {
    return (
      <Badge className="gap-1 bg-green-500/20 text-green-400 border-green-500/30">
        <CheckCircle2 className="w-3 h-3" /> Win
      </Badge>
    );
  }
  if (result === "loss") {
    return (
      <Badge className="gap-1 bg-red-500/20 text-red-400 border-red-500/30">
        <XCircle className="w-3 h-3" /> Loss
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
      Push
    </Badge>
  );
}

// ─── Parlay Card Component ────────────────────────────────────────────────────

function ParlayCard({ card }: { card: ParlayCardRow }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PARLAY_META[card.type];
  const Icon = meta.icon;

  return (
    <Card className="border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-muted/50", meta.color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">{meta.label}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={cn("text-2xl font-black tabular-nums", card.combinedOdds > 0 ? "text-green-400" : "text-foreground")}>
              {formatOdds(card.combinedOdds)}
            </span>
            <ResultBadge result={card.result} />
          </div>
        </div>

        {/* Leg count + record */}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>{card.totalLegs} legs</span>
          {card.result !== "pending" && card.result && (
            <>
              <span>·</span>
              <span className="text-green-400">{card.legsWon ?? 0}W</span>
              <span>/</span>
              <span className="text-red-400">{card.legsLost ?? 0}L</span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Legs preview (always show first 2, expand for rest) */}
        {card.dbLegs.slice(0, expanded ? card.dbLegs.length : 2).map((leg) => (
          <LegRow key={leg.id} leg={leg} />
        ))}

        {card.dbLegs.length > 2 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Show less" : `Show ${card.dbLegs.length - 2} more legs`}
          </button>
        )}

        {/* Parlay reasoning */}
        {card.reasoning && (
          <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">{card.reasoning}</p>
            </div>
          </div>
        )}

        {/* Post-game debrief (shown for graded cards) */}
        {card.postgameDebrief && card.result !== "pending" && (
          <PostGameDebrief debrief={card.postgameDebrief} result={card.result} />
        )}

        {/* Legacy loss analysis fallback */}
        {!card.postgameDebrief && card.result === "loss" && card.lossAnalysis && (
          <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-400 mb-1">Loss Analysis</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{card.lossAnalysis}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Post-Game Debrief Component ────────────────────────────────────────────

function PostGameDebrief({ debrief, result }: { debrief: string; result: ResultType | null }) {
  const [open, setOpen] = useState(false);
  const isWin = result === "win";
  const borderColor = isWin ? "border-green-500/20" : "border-amber-500/20";
  const bgColor = isWin ? "bg-green-500/5" : "bg-amber-500/5";
  const iconColor = isWin ? "text-green-400" : "text-amber-400";
  const labelColor = isWin ? "text-green-400" : "text-amber-400";

  // Parse sections from the debrief text
  const sections = [
    { key: "What Happened", icon: BookOpen, label: "What Happened" },
    { key: "What the Engine Missed", icon: AlertCircle, label: "What the Engine Missed" },
    { key: "How We Improve", icon: Lightbulb, label: "How We Improve" },
  ];

  function extractSection(text: string, heading: string, nextHeading?: string): string {
    const start = text.indexOf(`**${heading}:**`);
    if (start === -1) return "";
    const contentStart = start + heading.length + 6; // skip "**heading:**"
    const end = nextHeading ? text.indexOf(`**${nextHeading}:**`) : text.length;
    return text.slice(contentStart, end === -1 ? text.length : end).trim();
  }

  return (
    <div className={`mt-2 rounded-lg border ${borderColor} ${bgColor} overflow-hidden`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className={`w-3.5 h-3.5 ${iconColor}`} />
          <span className={`text-xs font-semibold ${labelColor}`}>Post-Game Debrief</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {sections.map(({ key, icon: SectionIcon, label }, i) => {
            const next = sections[i + 1]?.key;
            const content = extractSection(debrief, key, next);
            if (!content) return null;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <SectionIcon className="w-3 h-3 text-muted-foreground" />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed pl-4">{content}</p>
              </div>
            );
          })}
          {/* Fallback: show raw debrief if no sections parsed */}
          {sections.every(({ key }) => !extractSection(debrief, key)) && (
            <p className="text-xs text-foreground/80 leading-relaxed">{debrief}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Leg Row Component ────────────────────────────────────────────────────────

function LegRow({ leg }: { leg: ParlayLegRow }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const { isSyndicate } = useAccount();

  // Qualitative strength label for non-Syndicate viewers (no exact numbers).
  const edgeLabel =
    leg.edgeScore == null
      ? null
      : leg.edgeScore >= 0.08
      ? "Strong edge"
      : leg.edgeScore >= 0.04
      ? "Solid edge"
      : "Slight edge";

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
              {MARKET_LABEL[leg.market] ?? leg.market}
            </Badge>
            <span className="text-sm font-semibold text-foreground truncate">
              {leg.pickLabel || leg.pick}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {leg.awayTeam} @ {leg.homeTeam}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn("text-sm font-bold tabular-nums", leg.odds > 0 ? "text-green-400" : "text-foreground")}>
            {formatOdds(leg.odds)}
          </span>
          <ResultBadge result={leg.result} />
        </div>
      </div>

      {/* Edge + probability — exact numbers are a Syndicate perk */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {isSyndicate ? (
          <>
            {leg.edgeScore != null && (
              <span className="text-green-400 font-medium">
                Edge +{(leg.edgeScore * 100).toFixed(1)}%
              </span>
            )}
            {leg.modelProbability != null && (
              <span>Model: {(leg.modelProbability * 100).toFixed(0)}%</span>
            )}
            <span>Book: {impliedProb(leg.odds)}</span>
          </>
        ) : (
          <>
            {edgeLabel && <span className="text-green-400 font-medium">{edgeLabel}</span>}
            <span>Book: {impliedProb(leg.odds)}</span>
            <span className="text-muted-foreground/70 italic">Raw edge % · Syndicate</span>
          </>
        )}
      </div>

      {/* Reasoning toggle */}
      {leg.reasoning && (
        <>
          <button
            onClick={() => setShowReasoning((s) => !s)}
            className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
          >
            {showReasoning ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showReasoning ? "Hide reasoning" : "Why this pick?"}
          </button>
          {showReasoning && (
            <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/30 rounded p-2">
              {leg.reasoning}
            </p>
          )}
        </>
      )}

      {/* Actual outcome if graded */}
      {leg.actualOutcome && leg.result !== "pending" && (
        <p className="text-[11px] text-muted-foreground">
          Outcome: <span className="font-medium text-foreground">{leg.actualOutcome}</span>
        </p>
      )}
    </div>
  );
}

// ─── Record Badge ─────────────────────────────────────────────────────────────

function RecordDisplay({ record }: { record: { wins: number; losses: number; pushes: number; pending: number } }) {
  const total = record.wins + record.losses + record.pushes;
  const winPct = total > 0 ? ((record.wins / total) * 100).toFixed(0) : "—";

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-bold text-foreground">
          {record.wins}–{record.losses}
          {record.pushes > 0 ? `–${record.pushes}` : ""}
        </span>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">({winPct}% win rate)</span>
        )}
      </div>
      {record.pending > 0 && (
        <Badge variant="outline" className="text-muted-foreground text-xs">
          {record.pending} pending
        </Badge>
      )}
    </div>
  );
}

// ─── History Day ─────────────────────────────────────────────────────────────

function HistoryDay({ date, cards }: { date: string; cards: ParlayCardRow[] }) {
  const [open, setOpen] = useState(false);
  const wins = cards.filter((c) => c.result === "win").length;
  const losses = cards.filter((c) => c.result === "loss").length;
  const pending = cards.filter((c) => !c.result || c.result === "pending").length;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-foreground">
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <div className="flex items-center gap-2 text-xs">
            {wins > 0 && <span className="text-green-400 font-medium">{wins}W</span>}
            {losses > 0 && <span className="text-red-400 font-medium">{losses}L</span>}
            {pending > 0 && <span className="text-muted-foreground">{pending} pending</span>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="p-4 pt-0 grid gap-4">
          {cards.map((card) => (
            <ParlayCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ParlaysPage() {
  const [activeTab, setActiveTab] = useState("today");

  const todayQuery = trpc.parlay.getToday.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const historyQuery = trpc.parlay.getHistory.useQuery(
    { days: 14 },
    { enabled: activeTab === "history", refetchOnWindowFocus: false }
  );

  const generateMutation = trpc.parlay.generate.useMutation({
    onSuccess: (data) => {
      if (data.generated) {
        toast.success(`Generated ${data.count} parlays for today!`);
        todayQuery.refetch();
      } else if (data.reason === "already_exists") {
        toast.info("Today's parlays are already generated.");
      } else {
        toast.warning(`Could not generate: ${data.reason}`);
      }
    },
    onError: () => toast.error("Failed to generate parlays. Try again."),
  });

  const forceRegenMutation = trpc.parlay.generate.useMutation({
    onSuccess: () => {
      toast.success("Parlays regenerated!");
      todayQuery.refetch();
    },
    onError: () => toast.error("Regeneration failed."),
  });

  const gradeNowMutation = trpc.parlay.gradeNow.useMutation({
    onSuccess: (data) => {
      if (data.cardsGraded > 0) {
        toast.success(`Graded ${data.cardsGraded} cards, ${data.legsGraded} legs for ${data.date}`);
      } else {
        toast.info(`No pending cards to grade for ${data.date}. ${data.errors[0] ?? ""}`);
      }
      historyQuery.refetch();
    },
    onError: () => toast.error("Grading failed. Try again."),
  });

  // Auto-trigger generation if today has no parlays
  useEffect(() => {
    if (
      todayQuery.data &&
      todayQuery.data.cards.length === 0 &&
      !generateMutation.isPending
    ) {
      generateMutation.mutate({});
    }
  }, [todayQuery.data]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const cards = (todayQuery.data?.cards ?? []) as ParlayCardRow[];
  const TYPE_ORDER: ParlayType[] = ["power", "value", "lotto", "highvalue", "hrprop"];
  const sortedCards = [...cards].sort(
    (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
  );

  return (
    <RequireTier tier="sharp" featureName="Parlays of the Day">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              Parlays of the Day
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{today}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI-generated parlays using live odds, Statcast, weather, park factors &amp; umpire data
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => forceRegenMutation.mutate({ force: true })}
            disabled={forceRegenMutation.isPending}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", forceRegenMutation.isPending && "animate-spin")} />
            Regenerate
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-sm">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="model">Model Log</TabsTrigger>
          </TabsList>

          {/* ── Today Tab ── */}
          <TabsContent value="today" className="mt-6 space-y-4">
            {todayQuery.isLoading || generateMutation.isPending ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {generateMutation.isPending
                    ? "Generating today's parlays — fetching live odds, weather, and running model..."
                    : "Loading parlays..."}
                </div>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48 w-full rounded-xl" />
                ))}
              </div>
            ) : sortedCards.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <BarChart2 className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground text-sm">No parlays generated yet today.</p>
                <Button
                  size="sm"
                  onClick={() => generateMutation.mutate({})}
                  disabled={generateMutation.isPending}
                >
                  Generate Now
                </Button>
              </div>
            ) : (
              <>
                {/* Generation time */}
                {todayQuery.data?.generatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Generated at{" "}
                    {new Date(todayQuery.data.generatedAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {" — "}lines may have moved since generation
                  </p>
                )}
                {/* Parlay cards */}
                <div className="grid gap-4">
                  {sortedCards.map((card) => (
                    <ParlayCard key={card.id} card={card} />
                  ))}
                </div>
                {/* Disclaimer */}
                <p className="text-[11px] text-muted-foreground/60 text-center pt-2">
                  These are model-generated picks for entertainment and informational purposes only.
                  Always verify lines before placing bets. Gamble responsibly.
                </p>
              </>
            )}
          </TabsContent>

          {/* ── History Tab ── */}
          <TabsContent value="history" className="mt-6 space-y-4">
            {historyQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : (
              <>
                {/* Record summary */}
                {historyQuery.data && (
                  <div className="p-4 rounded-xl border border-border bg-card/60">
                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                      Last 14 Days — Model Record
                    </p>
                    <RecordDisplay record={historyQuery.data.record} />
                    <p className="text-xs text-muted-foreground mt-2">
                      {historyQuery.data.totalParlays} total parlays tracked
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => gradeNowMutation.mutate({})}
                        disabled={gradeNowMutation.isPending}
                      >
                        <RefreshCw className={cn("w-3 h-3", gradeNowMutation.isPending && "animate-spin")} />
                        {gradeNowMutation.isPending ? "Grading..." : "Grade Yesterday's Results"}
                      </Button>
                      <span className="text-[11px] text-muted-foreground">Runs automatically each morning</span>
                    </div>
                  </div>
                )}

                {/* Day-by-day history */}
                {historyQuery.data?.days.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      No graded history yet.
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Today's picks are pending — results will be graded automatically tonight after games finish,
                      or click "Grade Yesterday's Results" above to check now.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyQuery.data?.days.map(({ date, cards: daycards }) => (
                      <HistoryDay key={date} date={date} cards={daycards as ParlayCardRow[]} />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Model Log Tab ── */}
          <TabsContent value="model" className="mt-6 space-y-4">
            <ModelFeedbackLog />
          </TabsContent>
        </Tabs>
      </div>
    </RequireTier>
  );
}

// ─── Model Feedback Log ───────────────────────────────────────────────────────

function ModelFeedbackLog() {
  const feedbackQuery = trpc.parlay.getFeedback.useQuery({ days: 30 }, { refetchOnWindowFocus: false });

  const PARLAY_LABELS: Record<string, string> = {
    power: "Power Parlay",
    value: "Value Parlay",
    lotto: "Lotto Pick",
    highvalue: "High-Value Play",
    hrprop: "HR Prop Parlay",
  };

  if (feedbackQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
      </div>
    );
  }

  const feedback = feedbackQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-border bg-card/60">
        <h3 className="font-semibold text-sm mb-1">Self-Improving Model</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Every time a parlay loses, the model logs what went wrong — late lineup changes, pitcher
          scratches, weather shifts, or line movement. These signals are used to recalibrate
          confidence thresholds and improve future picks.
        </p>
      </div>

      {feedback.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No loss analysis yet — the model will log here after graded parlays.
        </p>
      ) : (
        <div className="space-y-3">
          {feedback.map((f) => (
            <div key={f.id} className="rounded-lg border border-border bg-card/60 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {PARLAY_LABELS[f.parlayType] ?? f.parlayType}
                  </Badge>
                  {f.marketType && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {f.marketType}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {typeof f.date === "string"
                    ? new Date(f.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : (f.date as Date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
              {f.missedReason && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    What we missed
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{f.missedReason}</p>
                </div>
              )}
              {f.dataSignals && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Data signals
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.dataSignals}</p>
                </div>
              )}
              {f.improvementNote && (
                <div className="p-2 rounded bg-primary/10 border border-primary/20">
                  <p className="text-[11px] font-semibold text-primary mb-0.5">Model improvement</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.improvementNote}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
