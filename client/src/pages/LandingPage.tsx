import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap, TrendingUp, BarChart3, Activity, Shield, Target,
  ChevronRight, Check, Star, Building2, Trophy,
  CheckCircle2, XCircle, Clock, ArrowRight,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="text-center space-y-1">
      <div className="text-3xl md:text-4xl font-bold text-primary">{value}</div>
      <div className="text-sm font-semibold text-foreground">{label}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color }: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <Card className="bg-card/50 border-border hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="p-5 space-y-3">
        <div className="inline-flex p-2 rounded-lg bg-muted/40">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultDot({ result }: { result: string }) {
  if (result === "win") return <CheckCircle2 className="w-4 h-4 text-green-400" />;
  if (result === "loss") return <XCircle className="w-4 h-4 text-red-400" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

const FEATURES = [
  {
    icon: Target,
    title: "ML-Powered Predictions",
    description: "Ensemble model analyzes 25+ features per game — pitchers, weather, park factors, umpire tendencies, and live odds.",
    color: "text-primary",
  },
  {
    icon: Activity,
    title: "Live Line Movement",
    description: "Track odds shifts from open to current. Spot steam moves and sharp money signals before the line moves further.",
    color: "text-blue-400",
  },
  {
    icon: TrendingUp,
    title: "Player Props Engine",
    description: "HR, strikeout, hits, RBI, and stolen base props with Statcast exit velocity and barrel rate analysis.",
    color: "text-green-400",
  },
  {
    icon: BarChart3,
    title: "Self-Grading Track Record",
    description: "Every parlay is auto-graded win/loss after games settle. Our live record is shown publicly — no cherry-picking.",
    color: "text-yellow-400",
  },
  {
    icon: Building2,
    title: "All 30 Teams Deep Dive",
    description: "Full standings, offense, pitching splits, and park factor analysis for every MLB team.",
    color: "text-purple-400",
  },
  {
    icon: Shield,
    title: "Umpire & Weather Intel",
    description: "Every game includes umpire K% tendencies, real-time ballpark weather, and wind impact on run totals.",
    color: "text-orange-400",
  },
];


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [, setLocation] = useLocation();

  const pickQuery = trpc.mlb.getFreePick.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const recordQuery = trpc.mlb.getPublicRecord.useQuery(
    { days: 14 },
    { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 }
  );

  const { data: founding } = trpc.stripe.getFoundingStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });

  const pick = pickQuery.data;
  const record = recordQuery.data;
  const pickError = pickQuery.isError;
  const recordError = recordQuery.isError;

  function handleGetStarted() {
    setLocation("/pricing");
  }

  function handleLogin() {
    window.location.href = getLoginUrl();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">MLB Edge</span>
            <Badge variant="outline" className="text-xs text-primary border-primary/40 hidden sm:inline-flex">
              2026 Season
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleLogin} className="text-muted-foreground">
              Sign In
            </Button>
            <Button size="sm" onClick={handleGetStarted} className="gap-1">
              Get Started <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <div className="space-y-6">
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs px-3 py-1">
                🔥 Live for 2026 MLB Season
              </Badge>
              <h1 className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight">
                Stop Guessing.
                <br />
                <span className="text-primary">Start Winning.</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                MLB Edge is the professional-grade betting intelligence platform built for serious bettors.
                Our ML model analyzes every game with{" "}
                <span className="text-foreground font-semibold">25+ real data points</span> — live odds,
                Statcast metrics, weather, umpire tendencies, and park factors.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button size="lg" onClick={() => setLocation("/free-pick")} className="gap-2 text-base px-8">
                  <Zap className="h-5 w-5" />
                  See Today's Free Pick
                </Button>
                <Button size="lg" variant="outline" onClick={handleGetStarted} className="gap-2 text-base">
                  View Pricing <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                One free pick daily — no account needed. Edge $9.99/mo · Sharp $19.99/mo · Syndicate $49.99/mo.
              </p>
            </div>

            {/* Right: live free pick preview card */}
            <div className="space-y-3">
              {/* Record strip */}
              {recordQuery.isLoading ? (
                <Skeleton className="h-12 w-full rounded-xl" />
              ) : record && record.totalGraded > 0 ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/60 flex-wrap">
                  <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
                  <span className="text-sm font-bold text-foreground">
                    {record.wins}–{record.losses}
                    {record.pushes > 0 ? `–${record.pushes}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">last 14 days</span>
                  {record.winPct !== null && (
                    <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 ml-auto">
                      {record.winPct}% win rate
                    </Badge>
                  )}
                  {record.recentResults.length > 0 && (
                    <div className="flex items-center gap-1">
                      {record.recentResults.map((r, i) => (
                        <ResultDot key={i} result={r.result} />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Free pick teaser */}
              {pickQuery.isLoading ? (
                <Card className="border border-border bg-card/80">
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-8 w-48 rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-3/4 rounded" />
                  </CardContent>
                </Card>
              ) : pickError ? (
                <Card className="border border-border bg-card/60">
                  <CardContent className="p-5 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Pick failed to load — </p>
                    <button className="text-xs text-primary underline" onClick={() => pickQuery.refetch()}>retry</button>
                  </CardContent>
                </Card>
              ) : pick ? (
                <Card className="border border-primary/30 bg-card/80 shadow-lg shadow-primary/5">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Today's Free Pick · {pick.awayTeam} @ {pick.homeTeam}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {pick.market === "moneyline" ? "Money Line" : pick.market === "runline" ? "Run Line" : "Total"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", pick.confidenceTier === "A"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                            )}
                          >
                            {pick.confidenceTier}-Tier
                          </Badge>
                        </div>
                      </div>
                      <div className={cn(
                        "text-2xl font-black tabular-nums shrink-0",
                        (pick.odds ?? 0) > 0 ? "text-green-400" : "text-foreground"
                      )}>
                        {formatOdds(pick.odds ?? 0)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-primary/70 font-medium uppercase tracking-wider mb-1">Pick</p>
                      <p className="text-base font-bold text-foreground">{pick.pickLabel || pick.pick}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-muted/30">
                        <p className="text-[10px] text-muted-foreground">Model</p>
                        <p className="text-xs font-bold text-foreground">
                          {pick.modelProbability ? `${(pick.modelProbability * 100).toFixed(0)}%` : "—"}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30">
                        <p className="text-[10px] text-muted-foreground">Book</p>
                        <p className="text-xs font-bold text-foreground">
                          {pick.impliedProbability ? `${(pick.impliedProbability * 100).toFixed(0)}%` : "—"}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-[10px] text-green-400/70">Edge</p>
                        <p className="text-xs font-bold text-green-400">
                          +{((pick.edgeScore ?? 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <Button
                      className="w-full gap-2"
                      variant="outline"
                      onClick={() => setLocation("/free-pick")}
                    >
                      See Full Reasoning <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-border bg-card/60">
                  <CardContent className="p-5 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Today's free pick loads after 9 AM ET.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setLocation("/free-pick")}>
                      Check Free Pick Page
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <StatCard
              value={record && record.totalGraded > 0 ? `${record.wins}–${record.losses}` : "—"}
              label="Live Record"
              sub="Last 14 days (graded)"
            />
            <StatCard
              value={record && record.winPct != null ? `${record.winPct}%` : "—"}
              label="Win Rate"
              sub="Recent graded parlays"
            />
            <StatCard value="5" label="Daily Parlays" sub="Built by the model" />
            <StatCard value="25+" label="Features Per Game" sub="ML model inputs" />
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-4 py-16 space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold text-foreground">Everything You Need to Find Edge</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Built by bettors, for bettors. Every feature is designed to surface information the books
            don't want you to have.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/10 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-16 space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-foreground">How It Works</h2>
            <p className="text-muted-foreground">Three steps from data to profitable picks</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Data Ingestion",
                description: "We pull live data from MLB Stats API, Statcast, The Odds API (10+ books), and OpenWeather for all 30 stadiums — refreshed every hour.",
              },
              {
                step: "02",
                title: "ML Analysis",
                description: "Our ensemble model scores each game across 25+ features, calculates true win probability, and compares it against book-implied odds to find edge.",
              },
              {
                step: "03",
                title: "Ranked Picks",
                description: "Picks are ranked by edge score and assigned A/B/C/D confidence tiers. You see exactly why the model likes each pick with full rationale.",
              },
            ].map(({ step, title, description }) => (
              <div key={step} className="space-y-3">
                <div className="text-4xl font-extrabold text-primary/30">{step}</div>
                <h3 className="text-lg font-bold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why trust the model (factual, no fabricated reviews) */}
      <section className="max-w-6xl mx-auto px-4 py-16 space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold text-foreground">Built on Data, Graded in Public</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            No hype, no fake reviews. Every pick shows its reasoning, and every parlay is
            auto-graded after the games settle so you can see the real record.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: "Transparent reasoning", body: "Each pick lists the exact factors — matchup, park, weather, umpire, recent form — behind it." },
            { title: "Self-grading record", body: "Wins and losses are tallied automatically. Postponed games are voided, never counted as wins." },
            { title: "No fabricated stats", body: "Model-derived numbers are labeled as estimates. We never present a guess as a confirmed reading." },
          ].map((c) => (
            <Card key={c.title} className="bg-card border-border">
              <CardContent className="p-5 space-y-2">
                <h3 className="font-bold text-foreground">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section className="bg-muted/10 border-y border-border">
        <div className="max-w-4xl mx-auto px-4 py-16 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold text-foreground">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground">
              Start free. Founding members lock their rate for life.
              {founding && founding.remaining > 0 ? ` ${founding.remaining} of ${founding.cap} founding spots left.` : ""}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                name: "Edge",
                price: "$9.99",
                priceSub: "/mo",
                promoNote: "or $99/yr (~2 months free)",
                annualPromo: "",
                features: ["All picks (ML/RL/O-U)", "Player props", "Line movement", "Full game analysis"],
                cta: "Get Edge",
                highlight: false,
                badge: "Best Value",
              },
              {
                name: "Sharp",
                price: "$19.99",
                priceSub: "/mo",
                promoNote: "or $199/yr (~2 months free)",
                annualPromo: "",
                features: ["Everything in Edge", "5 daily parlays", "Moonshot HR props", "Steam alerts"],
                cta: "Get Sharp",
                highlight: true,
                badge: "Most Popular",
              },
              {
                name: "Syndicate",
                price: "$49.99",
                priceSub: "/mo",
                promoNote: "or $499/yr (~2 months free)",
                annualPromo: "",
                features: ["Everything in Sharp", "Raw edge % on every leg", "Bankroll tracker (live ROI)", "Priority support"],
                cta: "Get Syndicate",
                highlight: false,
                badge: "Inner Circle",
              },
            ].map((tier) => (
              <Card
                key={tier.name}
                className={`${tier.highlight ? "border-primary ring-1 ring-primary" : "border-border"} bg-card`}
              >
                <CardContent className="p-5 space-y-4">
                  <Badge className={`text-xs ${
                    tier.highlight
                      ? "bg-primary text-primary-foreground"
                      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                  }`}>{tier.badge}</Badge>
                  <div>
                    <div className="font-bold text-lg text-foreground">{tier.name}</div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-foreground">{tier.price}</span>
                      <span className="text-sm text-muted-foreground">{tier.priceSub}</span>
                    </div>
                    <p className="text-xs text-green-400/80 mt-1">{tier.promoNote}</p>
                  </div>
                  <ul className="space-y-1.5">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-foreground">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full text-sm"
                    variant={tier.highlight ? "default" : "outline"}
                    onClick={handleGetStarted}
                  >
                    {tier.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
          Ready to Find Your Edge?
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Start with today's free pick — no account needed. When you're ready for all 5 daily parlays,
          upgrade to Sharp or Syndicate.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={() => setLocation("/free-pick")} className="gap-2 text-base px-8">
            <Zap className="h-5 w-5" />
            See Today's Free Pick
          </Button>
          <Button size="lg" variant="outline" onClick={handleGetStarted} className="gap-2 text-base">
            View All Plans
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Past performance is not indicative of future results. Sports betting involves risk.
          Please bet responsibly.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/10">
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded bg-primary">
                <Zap className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm text-foreground">MLB Edge</span>
              <span className="text-xs text-muted-foreground">© 2026</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <button onClick={() => setLocation("/free-pick")} className="hover:text-foreground transition-colors">
                Free Pick
              </button>
              <button onClick={() => setLocation("/pricing")} className="hover:text-foreground transition-colors">
                Pricing
              </button>
              <button onClick={() => setLocation("/terms")} className="hover:text-foreground transition-colors">
                Terms
              </button>
              <button onClick={() => setLocation("/privacy")} className="hover:text-foreground transition-colors">
                Privacy
              </button>
              <button onClick={() => setLocation("/refunds")} className="hover:text-foreground transition-colors">
                Refunds
              </button>
              <button onClick={() => setLocation("/responsible-gambling")} className="hover:text-foreground transition-colors">
                Responsible Gambling
              </button>
              <button onClick={handleLogin} className="hover:text-foreground transition-colors">
                Sign In
              </button>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground/80 text-center md:text-left">
            MLB Edge provides statistical analysis for informational and entertainment purposes only.
            It is not betting or financial advice, and no outcome is guaranteed. Past and backtested
            results do not guarantee future performance. You must be 21+ (or legal age in your
            jurisdiction) to use this service. Please bet responsibly. Gambling problem? Call
            1-800-GAMBLER. Not affiliated with or endorsed by Major League Baseball.
          </p>
        </div>
      </footer>
    </div>
  );
}
