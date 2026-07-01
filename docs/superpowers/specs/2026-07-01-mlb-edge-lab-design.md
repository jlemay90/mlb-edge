# MLB Edge Lab Design

## Purpose

MLB Edge Lab is a private, personal MLB prediction and betting-research platform. It will replace the subscription-oriented MLB Edge app with a model-first workspace for daily picks, parlays, explanations, grading, calibration, backtesting, and disciplined self-improvement.

The app is not a sales product. It will not include Stripe, subscriptions, pricing pages, public marketing funnels, affiliate sportsbook links, or paywall logic.

The primary goal is a fully functional model lab that can:

- Produce MLB moneyline, run line, total, and parlay picks.
- Explain why each pick makes sense using the actual model signals.
- Track odds at pick time and near close.
- Grade every pick and parlay after final results.
- Backtest historical performance using real final scores and historical odds where available.
- Improve model thresholds and calibration from enough settled evidence, without overfitting to a tiny losing streak.

## Source Context

The existing source repo is `jlemay90/mlb-edge`, cloned locally at `_source/mlb-edge`.

Useful source pieces to preserve:

- `server/services/predictionEngine.ts`: current moneyline, run line, total, prop, ROI, and prediction helpers.
- `server/services/mlbData.ts`: MLB schedule, odds, weather, lineups, pitcher form, bullpen usage, batter matchup, and park-factor helpers.
- `server/services/parlayEngine.ts`: daily parlay generation and leg reasoning.
- `server/services/parlayGrader.ts`: final score fetching, parlay grading, and postgame debrief generation.
- `server/mlbRouter.ts`: current tRPC procedures and data assembly flow.
- `drizzle/schema.ts`: current domain entities for predictions, odds snapshots, parlays, feedback, and bet tracking.

Important existing issues to fix:

- The current app is built around subscriptions, Stripe, Manus auth, billing, pricing, public free-pick teasers, and marketing copy.
- The current self-improvement assessment says the model is not automatically self-improving and does not change model weights.
- The current tests sometimes check copied formulas instead of the exported engine functions.
- Some backtest data is seeded or mock-like rather than built from a reproducible historical pipeline.
- Weather currently uses current conditions rather than first-pitch forecast logic.
- Model constants are hand-tuned and not versioned as model configurations.
- Loss analysis produces notes, but those notes do not drive validated calibration or model changes.

## Product Shape

The app will open directly into a personal analytics dashboard. There is no landing page.

Primary screens:

1. Today
   - Full MLB slate for the selected date.
   - Best picks ranked by expected value.
   - Filters for moneyline, run line, totals, props, and parlays.
   - Pick cards with model probability, no-vig implied probability, edge, confidence, odds, and status.

2. Pick Detail
   - Side-by-side book line vs model line.
   - Projected score and total.
   - Signal breakdown: starters, offense, bullpen, park, weather, lineup, umpire when available, recent form, and market movement.
   - A plain-English "why this pick makes sense" narrative generated from structured facts.
   - Data freshness and missing-data warnings.

3. Parlays
   - Daily parlay cards built from positive-edge legs.
   - Card types: power, value, high-value, lotto, HR-prop style only when enough real data exists.
   - Each leg links back to its pick detail.
   - Correlation warnings when multiple legs come from the same game.

4. Grading
   - Final results for picks and parlays.
   - Win, loss, push, void, and postponed handling.
   - Postgame debrief: what happened, what the model got right or wrong, and what signal should be reviewed.
   - A separate "model action" section that distinguishes narrative observations from actual model changes.

5. Backtest Lab
   - Date-range backtests by market, confidence tier, model version, and edge threshold.
   - ROI, win rate, units, average odds, average edge, hit rate, drawdown, and sample size.
   - Closing-line-value results where closing odds are available.
   - Calibration tables: predicted probability buckets vs actual hit rate.

6. Model Lab
   - Current model version and active thresholds.
   - Previous model versions and changelog.
   - Candidate threshold changes from backtest results.
   - Candidate weight/config changes that must pass validation before activation.
   - "Adopt" and "rollback" controls for local model versions.

7. Data Health
   - API key status without exposing secrets.
   - Last successful refresh for MLB schedule, odds, weather, Statcast, lineups, bullpen, and scores.
   - Missing-data warnings by game.
   - Odds quota usage where the provider exposes it.

## Side-by-Side Transformation

| Current MLB Edge | New MLB Edge Lab |
| --- | --- |
| Public/subscription product | Private personal model lab |
| Stripe, billing, tiers, pricing, paywall | No Stripe, no auth requirement, no sales pages |
| Daily picks mixed with product funnel | Daily slate is the first screen |
| Hand-tuned model constants inside code | Versioned model configuration with thresholds and weights tracked |
| Explanations are useful but not consistently tied to a saved feature snapshot | Every explanation is generated from the stored feature snapshot used for the pick |
| Grades parlays and writes debriefs | Grades picks and parlays, stores structured miss reasons, and updates calibration stats |
| "Self-improvement" is currently human-readable feedback only | Self-improvement means validated threshold tuning, calibration adjustment, and proposed model config changes after enough sample size |
| Some tests verify copied math | Tests call exported engine, grading, calibration, and backtest functions |
| Backtest data can be seeded/mock | Backtest pipeline uses historical final scores and historical odds snapshots |
| Weather uses current conditions | Weather uses forecast-at-first-pitch where possible |
| CLV not built | CLV is tracked from pick-time odds vs closing odds |

## API And Data Plan

Required keys:

- `ODDS_API_KEY`: The Odds API for current MLB moneyline, run line, totals, player props, and historical odds if the account includes it.
- `OPENAI_API_KEY`: Optional for app execution if deterministic template explanations are enough, but required for rich natural-language pick explanations, parlay debriefs, and model-change summaries.

Weather:

- Use the free National Weather Service API as the primary weather source for U.S. parks. NWS does not require an API key, but requests should include an identifying User-Agent.
- Use a no-key global fallback such as Open-Meteo for non-U.S. parks or any location NWS cannot cover.
- Do not require `OPENWEATHER_API_KEY` for the first version.

No-key sources:

- MLB Stats API for schedule, probable pitchers, final scores, lineups, and game metadata.
- Baseball Savant/Statcast CSV endpoints for batted-ball and pitcher/batter signals.
- National Weather Service API for U.S. park forecasts and alerts.
- Open-Meteo for no-key non-U.S. forecast fallback.

Data storage:

- Use local SQLite for personal use by default.
- Store raw API responses or normalized snapshots where practical so backtests can be reproduced.
- Store every pick with the exact feature snapshot and model version used at generation time.

## Model Architecture

The first implementation keeps the existing TypeScript engine family but restructures it into testable, versioned modules:

- Odds math: American odds, implied probability, no-vig probability, expected value, payout, CLV.
- Feature builder: schedule, teams, starters, lineups, bullpen, park, weather, Statcast, odds, and market state.
- Run projection model: projected home runs, projected away runs, projected total.
- Market models: moneyline, run line, totals, props.
- Pick selector: filters by edge threshold, data quality, market confidence, and sample-supported rules.
- Parlay builder: combines picks while warning about correlation and refusing weak/no-data legs.
- Explanation builder: uses structured model facts to create the "why it makes sense."
- Grader: settles picks and parlays.
- Backtester: replays historical slates with historical odds and final results.
- Calibration engine: compares predicted probabilities to actual hit rates by market and probability bucket.
- Model version manager: stores active thresholds, weight changes, changelog, validation metrics, and rollbacks.

## Self-Improvement Policy

The system must not blindly change the model after one loss or one bad night. Baseball is too noisy.

Allowed automatic improvements:

- Adjust displayed confidence calibration when enough settled picks show overconfidence or underconfidence.
- Raise or lower market-specific edge thresholds after enough settled picks prove the change improves ROI, calibration, and CLV.
- Disable or downgrade a market, parlay type, or confidence tier when backtests and live graded results show it is not profitable.

Guardrails:

- Require a minimum sample size before threshold changes. Initial default: at least 100 settled picks for warning-level analysis and 200 settled picks per market for automatic threshold adoption.
- Compare candidate changes against a holdout period when historical data is available.
- Do not optimize only for win rate. Track ROI, CLV, drawdown, and calibration.
- Never modify a historical pick's feature snapshot or model version after it is generated.
- Every model change receives a version number, reason, before/after metrics, and rollback path.

AI-generated debriefs:

- LLM debriefs may summarize what happened and suggest signals to inspect.
- LLM debriefs do not directly alter model weights.
- A structured validator decides whether data supports a model change.

## Pick Explanation Policy

Every pick detail should answer:

- What is the bet?
- What odds were available?
- What probability does the model assign?
- What does the market imply after removing vig?
- What is the edge?
- Which signals contributed most?
- What data is missing or stale?
- What would make this pick weaker before first pitch?

Explanation examples should be grounded in saved data:

- "Model projects 5.1-4.2, creating a 59.4% home win probability against a 53.1% no-vig market."
- "Bullpen rest favors the home team: 82 rest score vs 43, with two away relievers flagged as fatigued."
- "Wind is forecast out to CF at 13 mph, adding 0.4 projected runs, but the roof/weather status is uncertain."

The app should avoid fabricated certainty. If a signal is estimated or unavailable, it must say so.

## Backtesting Requirements

Backtests must support:

- Date range.
- Market filter: moneyline, run line, totals, props where odds/results are available.
- Model version.
- Edge threshold.
- Minimum confidence tier.
- Optional same-day opening odds, pick-time odds, and closing odds.

Backtest outputs:

- Total picks.
- Wins, losses, pushes, voids.
- Win rate.
- ROI and units.
- Average odds.
- Average edge.
- CLV hit rate and average CLV where closing odds exist.
- Calibration by predicted probability bucket.
- Performance by market and confidence tier.

Historical data priority:

1. Use The Odds API historical snapshots when available.
2. Use locally stored odds snapshots for days after the app starts running.
3. Backtest without CLV only when historical closing odds are missing, and clearly label the limitation.

## Web App Architecture

Recommended stack:

- TypeScript.
- React + Vite frontend.
- Node API with tRPC or lightweight REST.
- SQLite local database.
- Vitest for engine and API tests.
- Playwright or Browser plugin for frontend verification.

The existing app's UI components can be reused selectively, but the new app should be a cleaner personal dashboard and not carry over subscription UI.

Initial routes:

- `/` -> Today dashboard.
- `/picks/:pickId` -> Pick detail.
- `/parlays` -> Parlays.
- `/grading` -> Results and debriefs.
- `/backtest` -> Backtest Lab.
- `/model` -> Model Lab.
- `/data` -> Data Health.

## Testing And Verification

Required test categories:

- Odds conversion and no-vig math.
- Projected runs and market probability behavior.
- Pick selection thresholds.
- Parlay generation and correlation warnings.
- Grading moneyline, run line, totals, pushes, postponements, and voids.
- Calibration bucket math.
- Model threshold candidate evaluation.
- Backtest summary calculations.
- API key status reporting without exposing secrets.

The frontend must be verified by running the app locally and checking:

- Today dashboard loads.
- Pick detail explains why the pick makes sense.
- Backtest page runs a sample backtest.
- Model Lab shows active model version and calibration status.
- Grading page shows settled sample or seeded development data.

## Repo Plan

Target new repo:

- Owner: `jlemay90`.
- Name: `mlb-edge-lab`.
- Visibility: private.

The current GitHub connector can read existing repositories and update files, but it does not expose a create-repository tool in this session. To create the remote, either:

- Create an empty private `jlemay90/mlb-edge-lab` repo in GitHub and I will push to it, or
- Provide a local `GITHUB_TOKEN` with repo creation scope as an environment variable, and I will create it through the GitHub API without the token being pasted in chat.

## Implementation Phases

Phase 1: Personal lab foundation

- Create clean app shell.
- Remove sales/auth/payment concepts.
- Add SQLite schema.
- Port and test core engine math.
- Add API key health page.

Phase 2: Daily picks and explanations

- Fetch schedule, odds, weather, team/player context.
- Generate picks with feature snapshots.
- Show Today and Pick Detail screens.
- Add structured explanation builder.

Phase 3: Parlays and grading

- Generate parlay cards from qualified picks.
- Grade picks and parlays from final scores.
- Add postgame debriefs.

Phase 4: Backtesting and CLV

- Import or fetch historical odds.
- Replay historical slates.
- Compare pick-time odds vs closing odds.
- Display ROI, win rate, calibration, and CLV.

Phase 5: Self-improvement

- Add calibration buckets.
- Add threshold tuning candidates.
- Add model version manager.
- Allow adoption only when validation gates pass.
