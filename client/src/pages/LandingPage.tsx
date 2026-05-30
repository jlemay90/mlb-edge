import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Zap, TrendingUp, BarChart3, Activity, Shield, Target,
  ChevronRight, Check, Star, Users, MoveHorizontal, Building2
} from "lucide-react";
import { getLoginUrl } from "@/const";

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
        <div className={`inline-flex p-2 rounded-lg bg-muted/40`}>
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
    title: "Backtested Analytics",
    description: "2024 season results: 62.4% win rate on A-grade picks, +19.2% ROI on 1-unit flat betting.",
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

const TESTIMONIALS = [
  {
    text: "Finally a tool that actually explains WHY it likes a pick. The umpire and weather data alone is worth it.",
    author: "Sharp bettor, 3+ years",
    stars: 5,
  },
  {
    text: "Hit 7 of my last 10 A-grade picks using this. The edge scores are legit.",
    author: "Pro subscriber",
    stars: 5,
  },
  {
    text: "The line movement tracker caught a steam move on a Cubs game 2 hours before it moved 15 points. Cashed.",
    author: "Sharp subscriber",
    stars: 5,
  },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();

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
          <div className="max-w-3xl space-y-6">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs px-3 py-1">
                🔥 Live for 2026 MLB Season
              </Badge>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight">
              Stop Guessing.
              <br />
              <span className="text-primary">Start Winning.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              MLB Edge is the professional-grade betting intelligence platform built for serious bettors.
              Our ML model analyzes every game with{" "}
              <span className="text-foreground font-semibold">25+ real data points</span> — live odds,
              Statcast metrics, weather, umpire tendencies, and park factors — to find the highest-edge picks
              before the lines move.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button size="lg" onClick={handleGetStarted} className="gap-2 text-base px-8">
                <Zap className="h-5 w-5" />
                Start Free Today
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLocation("/pricing")} className="gap-2 text-base">
                View Pricing
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              No credit card required for free tier. Cancel Pro/Sharp anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <StatCard value="62.4%" label="2024 Win Rate" sub="A-grade picks" />
            <StatCard value="+19.2%" label="2024 ROI" sub="1-unit flat bet" />
            <StatCard value="2,430" label="Games Analyzed" sub="Full 2024 season" />
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

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-4 py-16 space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold text-foreground">What Bettors Are Saying</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed">"{t.text}"</p>
                <p className="text-xs text-muted-foreground">— {t.author}</p>
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
            <p className="text-muted-foreground">Start free. Upgrade when you're ready to go all-in.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                name: "Free",
                price: "$0",
                features: ["Top 3 daily picks", "Game schedule", "Team standings"],
                cta: "Start Free",
                highlight: false,
              },
              {
                name: "Pro",
                price: "$29/mo",
                features: ["All picks (ML/RL/O-U)", "Player props", "Line movement", "Game detail"],
                cta: "Go Pro",
                highlight: true,
              },
              {
                name: "Sharp",
                price: "$79/mo",
                features: ["Everything in Pro", "Parlay builder", "Moonshot HR props", "Steam alerts"],
                cta: "Go Sharp",
                highlight: false,
              },
            ].map((tier) => (
              <Card
                key={tier.name}
                className={`${tier.highlight ? "border-primary ring-1 ring-primary" : "border-border"} bg-card`}
              >
                <CardContent className="p-5 space-y-4">
                  {tier.highlight && (
                    <Badge className="bg-primary text-primary-foreground text-xs">Most Popular</Badge>
                  )}
                  <div>
                    <div className="font-bold text-lg text-foreground">{tier.name}</div>
                    <div className="text-2xl font-extrabold text-foreground mt-1">{tier.price}</div>
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
                    className={`w-full text-sm ${tier.highlight ? "" : "variant-outline"}`}
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
          Join MLB Edge today. Start free, upgrade when you're winning. Our model is live for the
          2026 season — don't bet blind.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={handleGetStarted} className="gap-2 text-base px-10">
            <Zap className="h-5 w-5" />
            Get Started Free
          </Button>
          <Button size="lg" variant="outline" onClick={handleLogin} className="gap-2 text-base">
            Sign In
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Past performance is not indicative of future results. Sports betting involves risk.
          Please bet responsibly.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/10">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded bg-primary">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm text-foreground">MLB Edge</span>
            <span className="text-xs text-muted-foreground">© 2026</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <button onClick={() => setLocation("/pricing")} className="hover:text-foreground transition-colors">
              Pricing
            </button>
            <button onClick={handleLogin} className="hover:text-foreground transition-colors">
              Sign In
            </button>
            <button onClick={handleGetStarted} className="hover:text-foreground transition-colors">
              Get Started
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
