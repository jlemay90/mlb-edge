/**
 * Free Pick of the Day — Public page, no login required.
 * This is the shareable link for social media growth.
 * URL: /free-pick
 */

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Zap,
  TrendingUp,
  Target,
  ChevronRight,
  Trophy,
  Share2,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart2,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { SportsbookLinks } from "@/components/SportsbookLinks";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function impliedProb(odds: number): string {
  const p = odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  return `${(p * 100).toFixed(0)}%`;
}

const MARKET_LABELS: Record<string, string> = {
  moneyline: "Money Line",
  runline: "Run Line (-1.5)",
  total: "Total",
};

const TIER_COLORS: Record<string, string> = {
  A: "bg-green-500/20 text-green-400 border-green-500/30",
  B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  D: "bg-muted text-muted-foreground border-border",
};

const PARLAY_TYPE_LABELS: Record<string, string> = {
  power: "Power Parlay",
  value: "Value Parlay",
  lotto: "Lotto Pick",
  highvalue: "High-Value Play",
  hrprop: "HR Prop",
};

// ─── Result Icon ──────────────────────────────────────────────────────────────

function ResultIcon({ result }: { result: string }) {
  if (result === "win") return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  if (result === "loss") return <XCircle className="w-4 h-4 text-red-400" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FreePickPage() {
  const [, setLocation] = useLocation();

  const pickQuery = trpc.mlb.getFreePick.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const recordQuery = trpc.mlb.getPublicRecord.useQuery(
    { days: 14 },
    { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 }
  );

  const pick = pickQuery.data;
  const record = recordQuery.data;
  const pickError = pickQuery.isError;
  const recordError = recordQuery.isError;

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: "MLB Edge — Free Pick of the Day",
        text: pick
          ? `Today's free MLB pick: ${pick.pickLabel || pick.pick} (${formatOdds(pick.odds ?? 0)}) — ML model, ${pick.confidenceTier}-tier confidence. Check it out:`
          : "Check out today's free MLB pick from MLB Edge:",
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast.success("Link copied to clipboard!");
      });
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base text-foreground">MLB Edge</span>
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={handleShare}
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </Button>
            <Button size="sm" onClick={() => setLocation("/pricing")} className="gap-1">
              Get All Picks <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
              🔥 Free Pick of the Day
            </Badge>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Today's Best MLB Pick
          </h1>
          <p className="text-sm text-muted-foreground">{today}</p>
          <p className="text-xs text-muted-foreground/70">
            One free pick daily — powered by the same ML model used in our paid parlays.
          </p>
        </div>

        {/* Record strip */}
        {recordQuery.isLoading ? (
          <Skeleton className="h-12 w-full rounded-xl" />
        ) : recordError ? (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card/60">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Record unavailable — </span>
            <button className="text-xs text-primary underline" onClick={() => recordQuery.refetch()}>retry</button>
          </div>
        ) : record && record.totalGraded > 0 ? (
          <div className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card/60 flex-wrap">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold text-foreground">
                {record.wins}–{record.losses}
                {record.pushes > 0 ? `–${record.pushes}` : ""}
              </span>
              <span className="text-xs text-muted-foreground">last 14 days</span>
            </div>
            {record.winPct !== null && (
              <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
                {record.winPct}% win rate
              </Badge>
            )}
            {record.recentResults.length > 0 && (
              <div className="flex items-center gap-1 ml-auto">
                {record.recentResults.map((r, i) => (
                  <ResultIcon key={i} result={r.result} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card/60">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Record tracking starts after first graded results tonight.
            </span>
          </div>
        )}

        {/* Free pick card */}
        {pickQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48 rounded" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : pickError ? (
          <Card className="border border-border bg-card/80">
            <CardContent className="p-8 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Failed to load today's pick. Check your connection.
              </p>
              <Button variant="outline" size="sm" onClick={() => pickQuery.refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : !pick ? (
          <Card className="border border-border bg-card/80">
            <CardContent className="p-8 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                No A/B-tier pick available yet today. Check back after 9 AM ET when the model runs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-primary/30 bg-card/80 shadow-lg shadow-primary/5">
            <CardContent className="p-5 space-y-4">
              {/* Matchup header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {pick.awayTeam} @ {pick.homeTeam}
                    {pick.homePitcher && pick.awayPitcher && (
                      <span className="ml-1">
                        · {pick.awayPitcher} vs {pick.homePitcher}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {MARKET_LABELS[pick.market] ?? pick.market}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", TIER_COLORS[pick.confidenceTier ?? "D"])}
                    >
                      {pick.confidenceTier}-Tier Confidence
                    </Badge>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn(
                    "text-3xl font-black tabular-nums",
                    (pick.odds ?? 0) > 0 ? "text-green-400" : "text-foreground"
                  )}>
                    {formatOdds(pick.odds ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Book: {impliedProb(pick.odds ?? -110)}
                  </p>
                </div>
              </div>

              {/* The pick */}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-primary/70 font-medium uppercase tracking-wider mb-1">
                  Today's Pick
                </p>
                <p className="text-lg font-bold text-foreground">
                  {pick.pickLabel || pick.pick}
                </p>
              </div>

              {/* Edge stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Model Win %</p>
                  <p className="text-sm font-bold text-foreground">
                    {pick.modelProbability ? `${(pick.modelProbability * 100).toFixed(0)}%` : "—"}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Book Implied</p>
                  <p className="text-sm font-bold text-foreground">
                    {impliedProb(pick.odds ?? -110)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-xs text-green-400/70">Edge</p>
                  <p className="text-sm font-bold text-green-400">
                    +{((pick.edgeScore ?? 0) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Rationale */}
              {pick.rationale && (
                <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
                  <div className="flex items-start gap-2">
                    <Target className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {pick.rationale}
                    </p>
                  </div>
                </div>
              )}

              {/* Game time */}
              {pick.gameDate && (
                <p className="text-xs text-muted-foreground text-center">
                  Game time:{" "}
                  {new Date(pick.gameDate).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZoneName: "short",
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sportsbook links — shown when a pick is available */}
        {pick && (
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <SportsbookLinks label="Place this bet at:" show={["draftkings", "fanduel", "betmgm", "caesars"]} />
          </div>
        )}

        {/* Upgrade CTA */}
        <div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                Want all 5 daily parlays?
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Sharp members get 5 AI-generated parlays every morning — Power, Value, Lotto,
                High-Value, and HR Prop — each with full reasoning, edge scores, and post-game debriefs.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              "5 daily parlays (Power, Value, Lotto, HR Prop)",
              "Full model reasoning per pick",
              "Post-game debrief after results",
              "Line movement tracking",
              "Player props with edge scores",
              "Live odds + Statcast data",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="w-3 h-3 text-primary shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="flex-1 gap-2"
              onClick={() => setLocation("/pricing")}
            >
              <Zap className="w-4 h-4" />
              Get Sharp — $19.99/mo
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { window.location.href = getLoginUrl(); }}
            >
              Sign In
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/60 text-center">
            Edge $9.99/mo · Sharp $19.99/mo · Syndicate $49.99/mo. Cancel anytime.
          </p>
        </div>

        {/* Disclaimer */}
        <p className="text-[11px] text-muted-foreground/50 text-center pb-4">
          This pick is for informational and entertainment purposes only. Always verify lines before
          placing bets. Must be 21+ to gamble. Gamble responsibly. 1-800-GAMBLER.
        </p>
      </div>
    </div>
  );
}
