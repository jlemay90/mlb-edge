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
import { useEffect, useMemo, useState } from "react";
import { buildPickExplanation } from "../domain/explanations";
import { sampleModelPreview } from "../domain/sampleData";
import { type Pick } from "../domain/picks";

type View = "Today" | "Parlays" | "Grading" | "Backtest" | "Model Lab" | "Data Health";
type TodayGame = {
  gameId: string;
  gameDate: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  venue?: string;
  homeProbablePitcher?: string;
  awayProbablePitcher?: string;
};
type TodayApiResponse = {
  date: string;
  games: TodayGame[];
  picks: Pick[];
  modelVersion: string;
  scheduleError?: string;
};
type ApiHealthSource = {
  name: string;
  status: string;
  requiresKey: boolean;
};
type DataHealthResponse = {
  sources: ApiHealthSource[];
};
type HistoricalOddsHealth = {
  configured: boolean;
  ok: boolean;
  checkedAt: string;
  snapshotDate: string;
  eventCount: number;
  source?: string;
  seasons?: number[];
  status?: number;
  requestUsage?: {
    requestsRemaining?: string;
    requestsUsed?: string;
    requestsLast?: string;
  };
  error?: string;
};
type LiveOddsHealth = Omit<HistoricalOddsHealth, "snapshotDate">;
type HistoricalImportReport = {
  generatedAt: string;
  seasons: number[];
  oddsApiConfigured: boolean;
  maxOddsSnapshots: number;
  maxOddsApiCredits?: number | null;
  maxWeatherSnapshots?: number | null;
  maxPitcherLogRequests?: number | null;
  apiCallLedgerPath?: string;
  totals: {
    games: number;
    finalResults: number;
    venueContexts: number;
    estimatedPregameOddsSnapshots: number;
    oddsSnapshotsCached: number;
    oddsSnapshotsChecked: number;
    oddsApiRequestsMade?: number;
    oddsApiCreditsSpent?: number;
    oddsSnapshotsFullMarket: number;
    oddsSnapshotsMoneylineOnly: number;
    oddsEventsSeen: number;
    weatherSnapshotsCached: number;
    weatherSnapshotsChecked: number;
    weatherSnapshotsFailed: number;
    pitcherLogsCached?: number;
    pitcherLogsChecked?: number;
    pitcherLogsFailed?: number;
    featureSnapshotCandidates: number;
    featureDrafts: number;
    featureDraftMissingSignals: Record<string, number>;
    featureSnapshots: number;
  };
  seasonReports: Array<{
    season: number;
    status: string;
    games: number;
    finalResults: number;
    venueContexts: number;
    estimatedPregameOddsSnapshots: number;
    oddsSnapshotsCached: number;
    oddsSnapshotsChecked: number;
    oddsApiRequestsMade?: number;
    oddsApiCreditsSpent?: number;
    oddsSnapshotsFullMarket: number;
    oddsSnapshotsMoneylineOnly: number;
    oddsEventsSeen: number;
    weatherSnapshotsCached: number;
    weatherSnapshotsChecked: number;
    weatherSnapshotsFailed: number;
    pitcherLogsCached?: number;
    pitcherLogsChecked?: number;
    pitcherLogsFailed?: number;
    featureSnapshotCandidates: number;
    featureDrafts: number;
    featureDraftMissingSignals: Record<string, number>;
    nextOddsSnapshotTimes: string[];
    featureSnapshots: number;
    blockers: string[];
  }>;
  blockers: string[];
};
type HistoricalReplayReport = {
  seasons: number[];
  requiredSeasonCount: number;
  completedSeasonCount: number;
  status: string;
  summary: {
    dateRange?: {
      start: string;
      end: string;
    };
    totalPicks: number;
    record: {
      wins: number;
      losses: number;
      pushes: number;
      voids: number;
    };
    winRate: number;
    unitsStaked: number;
    profitUnits: number;
    roi: number;
    averageOdds: number;
    averageEdge: number;
    maxDrawdownUnits: number;
    clv: {
      count: number;
      averageProbabilityDelta?: number;
      missing: boolean;
    };
  };
  coverage: Array<{
    season: number;
    complete: boolean;
    scheduledGames: number;
    finalResults: number;
    oddsSnapshots: number;
    weatherSnapshots: number;
    parkFactors: number;
    featureSnapshots: number;
    blockers: string[];
  }>;
  blockers: string[];
  canClaimHighSuccessRate: boolean;
};

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
  const [todayData, setTodayData] = useState<TodayApiResponse | null>(null);
  const [todayError, setTodayError] = useState("");
  const [apiSources, setApiSources] = useState<ApiHealthSource[]>([]);
  const [selectedPickId, setSelectedPickId] = useState("");
  const [requestDate, setRequestDate] = useState(initialSlateDate);
  const livePicks = todayData?.picks ?? [];
  const availableSourceCount = apiSources.filter((source) => isSourceAvailable(source.status)).length;
  const selectedPick = useMemo(
    () => livePicks.find((pick) => pick.id === selectedPickId) ?? livePicks[0],
    [livePicks, selectedPickId]
  );

  useEffect(() => {
    let isMounted = true;

    fetch("/api/data-health")
      .then(async (response) => {
        const body = (await response.json()) as DataHealthResponse;
        if (isMounted && response.ok) {
          setApiSources(body.sources);
        }
      })
      .catch(() => {
        if (isMounted) {
          setApiSources([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    setTodayData(null);
    setTodayError("");
    fetch(`/api/today?date=${requestDate}`)
      .then(async (response) => {
        const body = (await response.json()) as TodayApiResponse;
        if (isMounted) {
          setTodayData(body);
          setTodayError(response.ok ? "" : body.scheduleError ?? `HTTP ${response.status}`);
          setSelectedPickId(body.picks[0]?.id ?? "");
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setTodayError(error instanceof Error ? error.message : "Today slate failed to load.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [requestDate]);

  function updateRequestDate(date: string): void {
    setRequestDate(date);
    const url = new URL(window.location.href);
    url.searchParams.set("date", date);
    window.history.replaceState(null, "", url);
  }

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
            <p className="meta-label">{todayData?.date ?? requestDate}</p>
            <h2>{view === "Today" ? "Daily Model Preview" : view}</h2>
          </div>
          <div className="topbar-actions" aria-label="Model status">
            <label className="date-control">
              <span>Slate date</span>
              <input
                type="date"
                value={requestDate}
                onChange={(event) => updateRequestDate(event.currentTarget.value)}
              />
            </label>
            <span>Model {todayData?.modelVersion ?? "v1.0.0"}</span>
            <span>{livePicks.length} qualified picks</span>
            <span>{apiSources.length > 0 ? `${availableSourceCount}/${apiSources.length} sources` : "sources checking"}</span>
          </div>
        </header>

        {view === "Today" && (
          <TodayView
            games={todayData?.games ?? []}
            loading={!todayData && !todayError}
            picks={livePicks}
            scheduleError={todayData?.scheduleError ?? todayError}
            selectedPick={selectedPick}
            onSelectPick={setSelectedPickId}
          />
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
  games,
  loading,
  picks,
  scheduleError,
  selectedPick,
  onSelectPick,
}: {
  games: TodayGame[];
  loading: boolean;
  picks: Pick[];
  scheduleError?: string;
  selectedPick: Pick | undefined;
  onSelectPick: (id: string) => void;
}) {
  if (picks.length === 0) {
    return (
      <div className="dashboard-grid">
        <section className="panel slate-panel">
          <PanelTitle icon={Activity} title="Official MLB Schedule" detail="MLB Stats API" />
          {scheduleError && <div className="warning-list"><span>{scheduleError}</span></div>}
          <ScheduleTable games={games} loading={loading} />
        </section>

        <section className="panel">
          <PanelTitle icon={TrendingUp} title="Model Picks" detail="stored picks only" />
          <p className="muted-copy">No qualified model picks stored for this slate.</p>
        </section>

        <section className="panel">
          <PanelTitle icon={HeartPulse} title="Live Inputs" detail="current status" />
          <div className="health-grid">
            <div className="health-item">
              <div>
                <strong>Schedule</strong>
                <span>{games.length} official games loaded</span>
              </div>
              <span>{scheduleError ? "blocked" : loading ? "checking" : "live"}</span>
            </div>
            <div className="health-item">
              <div>
                <strong>Stored Picks</strong>
                <span>{picks.length} picks returned by the API</span>
              </div>
              <span>{picks.length > 0 ? "ready" : "empty"}</span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const activePick = selectedPick ?? picks[0]!;
  const activeExplanation = buildPickExplanation(activePick);

  return (
    <div className="dashboard-grid">
      <section className="panel slate-panel">
        <PanelTitle icon={Activity} title="Qualified Slate" detail="stored model picks" />
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
              {picks.map((pick) => (
                <tr
                  key={pick.id}
                  className={pick.id === activePick.id ? "selected" : ""}
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
        <PanelTitle icon={TrendingUp} title={activePick.label} detail="why this makes sense" />
        <div className="scoreline">{activeExplanation.projectedScore}</div>
        <p className="model-narrative">{activeExplanation.narrative}</p>
        <div className="metric-row">
          <Metric label="Model" value={`${activeExplanation.metrics.modelProbabilityPct.toFixed(1)}%`} />
          <Metric label="Market" value={`${activeExplanation.metrics.marketProbabilityPct.toFixed(1)}%`} />
          <Metric label="Edge" value={`${activeExplanation.metrics.edgePct.toFixed(1)}%`} tone="gold" />
        </div>
        <div className="signal-list">
          {activeExplanation.keySignals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
        <div className="warning-list">
          {activeExplanation.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={Activity} title="Official MLB Schedule" detail="MLB Stats API" />
        <ScheduleTable games={games} loading={loading} />
      </section>

      <section className="panel">
        <PanelTitle icon={LineChart} title="Backtest Snapshot" detail="seeded replay" />
        <BacktestMetrics compact />
      </section>
    </div>
  );
}

function ScheduleTable({ games, loading }: { games: TodayGame[]; loading: boolean }) {
  if (loading) {
    return <p className="muted-copy">Loading official MLB schedule.</p>;
  }

  if (games.length === 0) {
    return <p className="muted-copy">No official games returned for this date.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Game</th>
            <th>First Pitch</th>
            <th>Venue</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.gameId}>
              <td>
                <div className="row-pick">
                  <strong>{game.awayTeam} at {game.homeTeam}</strong>
                  <span>{pitcherLine(game)}</span>
                </div>
              </td>
              <td>{formatFirstPitch(game.gameDate)}</td>
              <td>{game.venue ?? "TBD"}</td>
              <td>{game.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const historical = sampleModelPreview.historicalBacktest;
  const [importReport, setImportReport] = useState<HistoricalImportReport | null>(null);
  const [importError, setImportError] = useState("");
  const [replayReport, setReplayReport] = useState<HistoricalReplayReport | null>(null);
  const [replayError, setReplayError] = useState("");
  const missingFeatureSignals = importReport
    ? topMissingFeatureSignals(importReport.totals.featureDraftMissingSignals ?? {})
    : [];

  useEffect(() => {
    let isMounted = true;

    fetch("/api/backtest/import-report")
      .then(async (response) => {
        const body = await response.json();
        if (isMounted) {
          if (response.ok) {
            setImportReport(body as HistoricalImportReport);
            setImportError("");
          } else {
            setImportError((body as { error?: string }).error ?? `HTTP ${response.status}`);
          }
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setImportError(error instanceof Error ? error.message : "Import report unavailable.");
        }
      });

    fetch(`/api/backtest/historical?asOf=${localTodayIsoDate()}`)
      .then(async (response) => {
        const body = await response.json();
        if (isMounted) {
          if (response.ok) {
            setReplayReport(body as HistoricalReplayReport);
            setReplayError("");
          } else {
            setReplayError((body as { error?: string }).error ?? `HTTP ${response.status}`);
          }
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setReplayError(error instanceof Error ? error.message : "Replay report unavailable.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="dashboard-grid two-col">
      <section className="panel">
        <PanelTitle
          icon={BarChart3}
          title={importReport ? "Import Summary" : "Backtest Summary"}
          detail={importReport ? "real MLB API coverage" : "demo replay"}
        />
        {importReport ? (
          <div className="metrics-grid">
            <Metric label="Games" value={String(importReport.totals.games)} />
            <Metric label="Results" value={String(importReport.totals.finalResults)} />
            <Metric label="Est. odds snapshots" value={String(importReport.totals.estimatedPregameOddsSnapshots)} />
            <Metric label="Cached odds" value={String(importReport.totals.oddsSnapshotsCached)} />
            <Metric label="Odds checked" value={String(importReport.totals.oddsSnapshotsChecked)} />
            <Metric label="API calls" value={String(importReport.totals.oddsApiRequestsMade ?? 0)} />
            <Metric label="API credits" value={String(importReport.totals.oddsApiCreditsSpent ?? 0)} />
            <Metric label="Full markets" value={String(importReport.totals.oddsSnapshotsFullMarket)} />
            <Metric label="ML only" value={String(importReport.totals.oddsSnapshotsMoneylineOnly)} />
            <Metric label="Weather" value={`${importReport.totals.weatherSnapshotsCached ?? 0}/${importReport.totals.featureDrafts ?? 0}`} />
            <Metric label="Pitcher logs" value={String((importReport.totals.pitcherLogsCached ?? 0) + (importReport.totals.pitcherLogsChecked ?? 0))} />
            <Metric label="Matched games" value={String(importReport.totals.featureSnapshotCandidates)} />
            <Metric label="Feature drafts" value={String(importReport.totals.featureDrafts ?? 0)} />
          </div>
        ) : (
          <BacktestMetrics />
        )}
      </section>
      <section className="panel">
        <PanelTitle
          icon={LineChart}
          title={replayReport ? "Replay Results" : importReport ? "Replay Status" : "Equity Shape"}
          detail={replayReport ? "cache-only scored picks" : importReport ? "cached import coverage" : "demo drawdown and CLV checks"}
        />
        {replayReport ? (
          <div className="metrics-grid">
            <Metric label="Status" value={replayReport.status} tone={replayReport.status === "verified" ? "gold" : undefined} />
            <Metric label="Picks" value={String(replayReport.summary.totalPicks)} />
            <Metric label="Record" value={`${replayReport.summary.record.wins}-${replayReport.summary.record.losses}-${replayReport.summary.record.pushes}`} />
            <Metric label="Win rate" value={formatPct(replayReport.summary.winRate)} />
            <Metric label="ROI" value={formatPct(replayReport.summary.roi)} tone={replayReport.summary.roi > 0 ? "gold" : undefined} />
            <Metric label="Profit" value={formatUnits(replayReport.summary.profitUnits)} tone={replayReport.summary.profitUnits > 0 ? "gold" : undefined} />
            <Metric label="Drawdown" value={formatUnits(replayReport.summary.maxDrawdownUnits)} />
            <Metric label="Avg edge" value={formatPct(replayReport.summary.averageEdge)} />
            <Metric label="CLV rows" value={String(replayReport.summary.clv.count)} />
          </div>
        ) : importReport ? (
          <>
            <p className="muted-copy">
              Cached odds and feature drafts are available. Run the replay command after import changes to refresh ROI, win rate, and drawdown.
            </p>
            <div className="signal-list">
              {missingFeatureSignals.length > 0 ? (
                missingFeatureSignals.map(([signal, count]) => (
                  <span key={signal}>{signal}: {count}</span>
                ))
              ) : (
                <span>No matched feature drafts yet</span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="equity-chart" aria-label="Equity curve preview">
              {Array.from({ length: 24 }, (_, index) => (
                <span key={index} style={{ height: `${32 + ((index * 17) % 58)}%` }} />
              ))}
            </div>
            <p className="muted-copy">
              Backtests report ROI, units, closing-line value coverage, and max drawdown. Missing CLV is marked instead of invented.
            </p>
          </>
        )}
      </section>
      <section className="panel wide-panel">
        <PanelTitle
          icon={ShieldCheck}
          title={replayReport ? "Historical Replay Coverage" : importReport ? "Historical Import Coverage" : "Historical 5-Season Status"}
          detail={replayReport ? replayReport.seasons.join(", ") : importReport ? importReport.seasons.join(", ") : `${historical.seasons[0]}-${historical.seasons[historical.seasons.length - 1]}`}
        />
        {replayReport ? (
          <>
            {replayError && <div className="warning-list"><span>{replayError}</span></div>}
            <div className="metric-row compact">
              <Metric label="Complete" value={`${replayReport.completedSeasonCount}/${replayReport.requiredSeasonCount}`} />
              <Metric label="Date range" value={replayReport.summary.dateRange ? `${replayReport.summary.dateRange.start} to ${replayReport.summary.dateRange.end}` : "not scored"} />
              <Metric label="Can claim high success" value={replayReport.canClaimHighSuccessRate ? "yes" : "no"} tone={replayReport.canClaimHighSuccessRate ? "gold" : undefined} />
            </div>
            <div className="coverage-grid">
              {replayReport.coverage.map((season) => (
                <div className="coverage-row" key={season.season}>
                  <strong>{season.season}</strong>
                  <span>{season.complete ? "complete" : "partial"}</span>
                  <span>{season.oddsSnapshots} odds</span>
                  <span>{season.finalResults} finals</span>
                  <span>{season.featureSnapshots} features</span>
                </div>
              ))}
            </div>
            <div className="warning-list">
              {replayReport.blockers.slice(0, 6).map((blocker) => (
                <span key={blocker}>{blocker}</span>
              ))}
            </div>
          </>
        ) : importReport ? (
          <>
            <div className="metric-row compact">
              <Metric label="Games" value={String(importReport.totals.games)} />
              <Metric label="Results" value={String(importReport.totals.finalResults)} />
              <Metric label="Odds" value={`${importReport.totals.oddsSnapshotsCached + importReport.totals.oddsSnapshotsChecked}/${importReport.totals.estimatedPregameOddsSnapshots}`} />
              <Metric label="Credits" value={String(importReport.totals.oddsApiCreditsSpent ?? 0)} />
            </div>
            <div className="coverage-grid">
              {importReport.seasonReports.map((season) => (
                <div className="coverage-row" key={season.season}>
                  <strong>{season.season}</strong>
                  <span>{season.status}</span>
                  <span>{season.games} games</span>
                  <span>{season.finalResults} results</span>
                  <span>{season.featureDrafts ?? season.featureSnapshotCandidates} drafts</span>
                </div>
              ))}
            </div>
            <div className="warning-list">
              {importReport.blockers.slice(0, 4).map((blocker) => (
                <span key={blocker}>{blocker}</span>
              ))}
            </div>
            <div className="signal-list">
              {importReport.seasonReports
                .find((season) => season.nextOddsSnapshotTimes.length > 0)
                ?.nextOddsSnapshotTimes.map((snapshotTime) => (
                  <span key={snapshotTime}>Next odds snapshot: {snapshotTime}</span>
                ))}
            </div>
          </>
        ) : (
          <>
            {importError && <div className="warning-list"><span>{importError}</span></div>}
            <div className="metric-row compact">
              <Metric label="Status" value={historical.status} tone={historical.status === "verified" ? "gold" : undefined} />
              <Metric label="Complete" value={`${historical.completedSeasonCount}/${historical.requiredSeasonCount}`} />
              <Metric label="Picks" value={String(historical.summary.totalPicks)} />
            </div>
            <div className="coverage-grid">
              {historical.coverage.map((season) => (
                <div className="coverage-row" key={season.season}>
                  <strong>{season.season}</strong>
                  <span>{season.complete ? "complete" : "missing data"}</span>
                  <span>{season.oddsSnapshots} odds</span>
                  <span>{season.finalResults} finals</span>
                  <span>{season.weatherSnapshots} weather</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function topMissingFeatureSignals(signalCounts: Record<string, number>): Array<[string, number]> {
  return Object.entries(signalCounts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8);
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
  const [sources, setSources] = useState<ApiHealthSource[]>([]);
  const [sourcesError, setSourcesError] = useState("");
  const [historicalOdds, setHistoricalOdds] = useState<HistoricalOddsHealth | null>(null);
  const [historicalOddsError, setHistoricalOddsError] = useState("");
  const [liveOdds, setLiveOdds] = useState<LiveOddsHealth | null>(null);
  const [liveOddsError, setLiveOddsError] = useState("");

  useEffect(() => {
    let isMounted = true;

    fetch("/api/data-health")
      .then(async (response) => {
        const body = (await response.json()) as DataHealthResponse;
        if (isMounted) {
          setSources(response.ok ? body.sources : []);
          setSourcesError(response.ok ? "" : `HTTP ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setSourcesError(error instanceof Error ? error.message : "Data health check failed.");
        }
      });

    fetch("/api/odds/live-check")
      .then(async (response) => {
        const body = (await response.json()) as LiveOddsHealth;
        if (isMounted) {
          setLiveOdds(body);
          setLiveOddsError(response.ok ? "" : body.error ?? `HTTP ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setLiveOddsError(error instanceof Error ? error.message : "Live odds check failed.");
        }
      });

    fetch("/api/odds/historical-check")
      .then(async (response) => {
        const body = (await response.json()) as HistoricalOddsHealth;
        if (isMounted) {
          setHistoricalOdds(body);
          setHistoricalOddsError(response.ok ? "" : body.error ?? `HTTP ${response.status}`);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setHistoricalOddsError(error instanceof Error ? error.message : "Historical odds check failed.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="panel">
      <PanelTitle icon={HeartPulse} title="Data Health" detail="secrets never displayed" />
      <div className="health-grid">
        {sources.length === 0 && (
          <div className="health-item">
            <div>
              <strong>Local API</strong>
              <span>{sourcesError || "Checking configured data sources."}</span>
            </div>
            <span>{sourcesError ? "error" : "checking"}</span>
          </div>
        )}
        {sources.map((source) => (
          <div className="health-item" key={source.name}>
            <div>
              <strong>{source.name}</strong>
              <span>{sourceDetail(source)}</span>
            </div>
            <span>{source.status}</span>
          </div>
        ))}
      </div>
      <div className="live-health">
        <div>
          <strong>Live Odds Access</strong>
          <span>{liveOddsDetail(liveOdds, liveOddsError)}</span>
        </div>
        <span className={`result-pill ${oddsHealthTone(liveOdds, liveOddsError)}`}>
          {oddsHealthStatus(liveOdds, liveOddsError)}
        </span>
      </div>
      <div className="live-health">
        <div>
          <strong>Historical Odds Access</strong>
          <span>{historicalOddsDetail(historicalOdds, historicalOddsError)}</span>
        </div>
        <span className={`result-pill ${oddsHealthTone(historicalOdds, historicalOddsError)}`}>
          {oddsHealthStatus(historicalOdds, historicalOddsError)}
        </span>
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

function formatUnits(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}u`;
}

function formatOdds(odds: number): string {
  return `${odds > 0 ? "+" : ""}${odds}`;
}

function localTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function initialSlateDate(): string {
  const date = new URLSearchParams(window.location.search).get("date");

  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localTodayIsoDate();
}

function formatFirstPitch(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function pitcherLine(game: TodayGame): string {
  if (!game.awayProbablePitcher && !game.homeProbablePitcher) {
    return game.venue ?? "";
  }

  return `${game.awayProbablePitcher ?? "TBD"} vs ${game.homeProbablePitcher ?? "TBD"}`;
}

function oddsHealthStatus(health: LiveOddsHealth | HistoricalOddsHealth | null, error: string): string {
  if (error && !health) return "error";
  if (!health) return "checking";
  if (health.ok && "source" in health && health.source === "cached-replay-report") return "cached";
  if (health.ok) return "connected";
  if (!health.configured) return "missing key";
  return "blocked";
}

function oddsHealthTone(health: LiveOddsHealth | HistoricalOddsHealth | null, error: string): string {
  if (!health && !error) return "push";
  return health?.ok ? "win" : "loss";
}

function isSourceAvailable(status: string): boolean {
  return !status.toLowerCase().startsWith("missing");
}

function sourceDetail(source: ApiHealthSource): string {
  if (source.name === "MLB Stats API") return "Schedules, venues, and final scores.";
  if (source.name === "The Odds API") return "Current odds for live picks.";
  if (source.name === "Historical Odds Cache") return "Backtesting reads stored called-games and odds snapshots.";
  if (source.name === "National Weather Service") return "U.S. stadium hourly weather.";
  if (source.name === "Open-Meteo") return "Weather fallback when NWS is unavailable.";
  if (source.name === "OpenAI") return "Optional narrative explanations.";
  return source.requiresKey ? "Requires a local key." : "No paid key required.";
}

function liveOddsDetail(health: LiveOddsHealth | null, error: string): string {
  if (error && !health) {
    return error;
  }

  if (!health) {
    return "Checking current MLB odds through the local API.";
  }

  if (health.ok) {
    return `${health.eventCount} current MLB events returned.`;
  }

  const status = health.status ? ` Status ${health.status}.` : "";
  return `${health.error ?? "Live odds check failed."}${status}${quotaDetail(health)}`;
}

function historicalOddsDetail(health: HistoricalOddsHealth | null, error: string): string {
  if (error && !health) {
    return error;
  }

  if (!health) {
    return "Reading cached historical odds coverage from the replay report.";
  }

  if (health.source === "cached-replay-report") {
    const seasons = health.seasons?.join(", ");
    return `${health.eventCount} cached historical odds snapshots${seasons ? ` across ${seasons}` : ""}.`;
  }

  if (health.ok) {
    return `${health.eventCount} events returned for ${health.snapshotDate}.`;
  }

  const status = health.status ? ` Status ${health.status}.` : "";
  return `${health.error ?? "Historical odds check failed."}${status}${quotaDetail(health)}`;
}

function quotaDetail(health: LiveOddsHealth | HistoricalOddsHealth): string {
  const usage = health.requestUsage;
  if (!usage?.requestsRemaining && !usage?.requestsUsed) {
    return "";
  }

  const parts = [
    usage.requestsRemaining ? ` remaining ${usage.requestsRemaining}` : undefined,
    usage.requestsUsed ? ` used ${usage.requestsUsed}` : undefined,
    usage.requestsLast ? ` last ${usage.requestsLast}` : undefined,
  ].filter((part): part is string => Boolean(part));

  return ` Quota:${parts.join(",")}.`;
}
