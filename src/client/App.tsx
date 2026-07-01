import {
  Activity,
  BarChart3,
  CheckCircle2,
  Gauge,
  HeartPulse,
  LineChart,
  ListChecks,
  ShieldCheck,
  Table2,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { sampleModelPreview } from "../domain/sampleData";
import { type Pick } from "../domain/picks";

type View = "Today" | "Parlays" | "Grading" | "Backtest" | "Model Lab" | "Data Health";

const navItems: Array<{ label: View; icon: typeof Table2 }> = [
  { label: "Today", icon: Table2 },
  { label: "Parlays", icon: ListChecks },
  { label: "Grading", icon: CheckCircle2 },
  { label: "Backtest", icon: BarChart3 },
  { label: "Model Lab", icon: Gauge },
  { label: "Data Health", icon: HeartPulse },
];

export function App() {
  const [view, setView] = useState<View>("Today");
  const [selectedPickId, setSelectedPickId] = useState(sampleModelPreview.picks[0]?.id ?? "");
  const selectedPick = useMemo(
    () => sampleModelPreview.picks.find((pick) => pick.id === selectedPickId) ?? sampleModelPreview.picks[0],
    [selectedPickId]
  );

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-lockup">
          <div className="brand-mark">ME</div>
          <div>
            <p>Personal Model Lab</p>
            <h1>MLB Edge Lab</h1>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={item.label === view ? "active" : ""}
                onClick={() => setView(item.label)}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="side-status">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>No sales layer</strong>
            <span>Personal picks only</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="meta-label">{sampleModelPreview.date}</p>
            <h2>{view === "Today" ? "Daily Model Preview" : view}</h2>
          </div>
          <div className="topbar-actions" aria-label="Model status">
            <span>Model v1.0.0</span>
            <span>{sampleModelPreview.picks.length} qualified picks</span>
            <span>{sampleModelPreview.apiHealth.filter((item) => item.status !== "Missing").length}/5 sources</span>
          </div>
        </header>

        {view === "Today" && selectedPick && (
          <TodayView selectedPick={selectedPick} onSelectPick={setSelectedPickId} />
        )}
        {view === "Parlays" && <ParlaysView />}
        {view === "Grading" && <GradingView />}
        {view === "Backtest" && <BacktestView />}
        {view === "Model Lab" && <ModelLabView />}
        {view === "Data Health" && <DataHealthView />}
      </section>
    </main>
  );
}

function TodayView({
  selectedPick,
  onSelectPick,
}: {
  selectedPick: Pick;
  onSelectPick: (id: string) => void;
}) {
  const explanation = sampleModelPreview.explanations[selectedPick.id];

  return (
    <div className="dashboard-grid">
      <section className="panel slate-panel">
        <PanelTitle icon={Activity} title="Qualified Slate" detail="sorted by model edge" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pick</th>
                <th>Market</th>
                <th>Odds</th>
                <th>Model</th>
                <th>Edge</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {sampleModelPreview.picks.map((pick) => (
                <tr
                  key={pick.id}
                  className={pick.id === selectedPick.id ? "selected" : ""}
                  onClick={() => onSelectPick(pick.id)}
                >
                  <td>
                    <button type="button" className="row-pick" onClick={() => onSelectPick(pick.id)}>
                      <strong>{pick.label}</strong>
                      <span>{pick.featureSnapshot.awayTeam} at {pick.featureSnapshot.homeTeam}</span>
                    </button>
                  </td>
                  <td>{pick.market}</td>
                  <td>{formatOdds(pick.odds)}</td>
                  <td>{formatPct(pick.modelProbability)}</td>
                  <td className="positive">{formatPct(pick.edge)}</td>
                  <td><Confidence tier={pick.confidenceTier} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel pick-detail">
        <PanelTitle icon={TrendingUp} title={selectedPick.label} detail="why this makes sense" />
        <div className="scoreline">{explanation.projectedScore}</div>
        <p className="model-narrative">{explanation.narrative}</p>
        <div className="metric-row">
          <Metric label="Model" value={`${explanation.metrics.modelProbabilityPct.toFixed(1)}%`} />
          <Metric label="Market" value={`${explanation.metrics.marketProbabilityPct.toFixed(1)}%`} />
          <Metric label="Edge" value={`${explanation.metrics.edgePct.toFixed(1)}%`} tone="gold" />
        </div>
        <div className="signal-list">
          {explanation.keySignals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
        <div className="warning-list">
          {explanation.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={ListChecks} title="Top Parlay" detail="qualified legs only" />
        <ParlayCard parlay={sampleModelPreview.parlays[0]} />
      </section>

      <section className="panel">
        <PanelTitle icon={LineChart} title="Backtest Snapshot" detail="seeded replay" />
        <BacktestMetrics compact />
      </section>
    </div>
  );
}

function ParlaysView() {
  return (
    <div className="panel-stack">
      {sampleModelPreview.parlays.map((parlay) => (
        <section className="panel" key={parlay.id}>
          <ParlayCard parlay={parlay} />
        </section>
      ))}
    </div>
  );
}

function GradingView() {
  return (
    <section className="panel">
      <PanelTitle icon={CheckCircle2} title="Postgame Grading" detail="sample final-score audit" />
      <div className="grading-list">
        {sampleModelPreview.gradedPicks.slice(0, 10).map((graded) => (
          <div className="grading-row" key={graded.pick.id}>
            <div>
              <strong>{graded.pick.label}</strong>
              <span>{graded.actualScore}</span>
            </div>
            <span className={`result-pill ${graded.result}`}>{graded.result}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BacktestView() {
  return (
    <div className="dashboard-grid two-col">
      <section className="panel">
        <PanelTitle icon={BarChart3} title="Backtest Summary" detail="220 pick replay" />
        <BacktestMetrics />
      </section>
      <section className="panel">
        <PanelTitle icon={LineChart} title="Equity Shape" detail="drawdown and CLV checks" />
        <div className="equity-chart" aria-label="Equity curve preview">
          {Array.from({ length: 24 }, (_, index) => (
            <span key={index} style={{ height: `${32 + ((index * 17) % 58)}%` }} />
          ))}
        </div>
        <p className="muted-copy">
          Backtests report ROI, units, closing-line value coverage, and max drawdown. Missing CLV is marked instead of invented.
        </p>
      </section>
    </div>
  );
}

function ModelLabView() {
  return (
    <div className="dashboard-grid two-col">
      <section className="panel">
        <PanelTitle icon={Gauge} title="Calibration Buckets" detail="predicted vs actual" />
        <div className="bucket-list">
          {sampleModelPreview.calibrationBuckets.slice(0, 5).map((bucket) => (
            <div className="bucket-row" key={bucket.label}>
              <span>{bucket.label}</span>
              <div className="bucket-bar">
                <span style={{ width: `${bucket.actualHitRate * 100}%` }} />
              </div>
              <strong>{formatPct(bucket.actualHitRate)}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={ShieldCheck} title="Threshold Candidates" detail="sample-size gated" />
        <div className="recommendation-list">
          {sampleModelPreview.thresholdRecommendations.map((recommendation) => (
            <div className="recommendation" key={recommendation.market}>
              <strong>{recommendation.market}</strong>
              <span>
                {formatPct(recommendation.currentThreshold)} to {formatPct(recommendation.proposedThreshold)}
              </span>
              <p>{recommendation.reason}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DataHealthView() {
  return (
    <section className="panel">
      <PanelTitle icon={HeartPulse} title="Data Health" detail="secrets never displayed" />
      <div className="health-grid">
        {sampleModelPreview.apiHealth.map((source) => (
          <div className="health-item" key={source.name}>
            <div>
              <strong>{source.name}</strong>
              <span>{source.detail}</span>
            </div>
            <span>{source.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ParlayCard({ parlay }: { parlay: (typeof sampleModelPreview.parlays)[number] | undefined }) {
  if (!parlay) {
    return <p className="muted-copy">No parlay qualifies for this slate.</p>;
  }

  return (
    <div className="parlay-card">
      <div className="parlay-head">
        <div>
          <h3>{parlay.title}</h3>
          <span>{parlay.legs.length} legs</span>
        </div>
        <strong>{formatOdds(parlay.combinedOdds)}</strong>
      </div>
      <div className="metric-row compact">
        <Metric label="Model" value={formatPct(parlay.modelProbability)} />
        <Metric label="Market" value={formatPct(parlay.impliedProbability)} />
        <Metric label="Edge" value={formatPct(parlay.edge)} tone="gold" />
      </div>
      <div className="leg-list">
        {parlay.legs.map((leg) => (
          <div className="leg" key={leg.pick.id}>
            <span className="leg-game">{leg.matchup}</span>
            <strong>{leg.pick.label}</strong>
            <span>{leg.reasoning.slice(0, 2).join(" | ")}</span>
          </div>
        ))}
      </div>
      {parlay.warnings.length > 0 && <div className="warning-list">{parlay.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}
    </div>
  );
}

function BacktestMetrics({ compact = false }: { compact?: boolean }) {
  const summary = sampleModelPreview.backtestSummary;
  const metrics = [
    ["Win rate", formatPct(summary.winRate)],
    ["ROI", formatPct(summary.roi)],
    ["Units", summary.profitUnits.toFixed(2)],
    ["Drawdown", summary.maxDrawdownUnits.toFixed(2)],
    ["CLV", summary.clv.averageProbabilityDelta ? formatPct(summary.clv.averageProbabilityDelta) : "missing"],
  ];

  return (
    <div className={compact ? "metrics-grid compact-grid" : "metrics-grid"}>
      {metrics.map(([label, value]) => (
        <Metric key={label} label={label} value={value} tone={label === "Units" ? "gold" : undefined} />
      ))}
    </div>
  );
}

function PanelTitle({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) {
  return (
    <div className="panel-title">
      <Icon size={18} aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Confidence({ tier }: { tier: Pick["confidenceTier"] }) {
  return <span className={`confidence tier-${tier.toLowerCase()}`}>{tier}</span>;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatOdds(odds: number): string {
  return `${odds > 0 ? "+" : ""}${odds}`;
}
