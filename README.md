# MLB Edge Lab

Personal MLB picks lab focused on explainable model picks, live schedule/odds inputs, historical backtesting, and postgame calibration.

This app is intentionally not wired for Stripe, subscriptions, or public selling. It is built as a private betting research tool.

## Current Status

- Live MLB schedule: MLB Stats API, no key required.
- Live odds: The Odds API, key required.
- Historical odds: The Odds API historical endpoint, key required.
- Weather: National Weather Service for U.S. parks, Open-Meteo fallback/archive.
- OpenAI: configured for optional narrative/debrief work, not required for core math.
- Historical import report: `data/historical/import-report.json`, generated locally and ignored by git.

Latest local import evidence:

- Seasons planned: 2020, 2021, 2022, 2023, 2024, 2025.
- Games/results imported from MLB Stats API: 13,373 games, 13,373 final results.
- Planned historical odds snapshots: 5,492 hourly snapshots.
- Cached historical odds snapshots: 2,640 full-market snapshots.
- Paid Odds API pull ledger: 2,000 historical requests, 60,000 credits spent, stored in `data/historical/api-calls.jsonl`.
- Historical odds events seen: 42,571.
- Odds cache manifest: 2,640 snapshots, 684,318,849 bytes, stored in `data/historical/odds-cache-manifest.json`.
- Matched feature-draft games: 6,408, counted only when the cached odds event matches the MLB scheduled game.
- Cached matched historical weather snapshots: 6,406 of 6,408, sourced from Open-Meteo archive using MLB venue coordinates.
- Derived pregame features now fill most season-to-date offense, recent form, bullpen-rest proxy, and venue scoring context from prior games only.
- Current feature-draft gaps: 318 still need team offense/recent form sample, 65 need bullpen rest, 2,442 need park factors, 2 need weather, and all 6,408 still need starter pitching plus confirmed lineup data before verified replay.
- Remaining blocker: feature snapshots and complete odds coverage are not finished, so the app must not claim a verified high-success five-season backtest yet.

The Odds API historical docs say historical odds are available from June 6, 2020, and the MLB sport starts in that provider window with the 2020 shortened season:
https://the-odds-api.com/liveapi/guides/v4/#historical-odds

## Environment

Copy `.env.example` to `.env` locally and fill in:

```env
ODDS_API_KEY=
OPENAI_API_KEY=
NWS_USER_AGENT=mlb-edge-lab/1.0 (your-email@example.com)
```

Do not commit `.env`. It is ignored by git.

For deployment, set the same variables in the hosting provider's environment variable dashboard.

## Local Development

Run the API:

```bash
npm run server
```

Run the Vite client:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000/
```

## Production Run

Build the client:

```bash
npm run build
```

Start the combined API + built web app:

```bash
npm start
```

The server listens on `PORT` if provided by the host, otherwise `4000`. It binds to `0.0.0.0` for hosted deployment.

## Backtesting

The importer is quota-aware and caches every successful historical odds snapshot under `data/historical/odds-cache`. Historical weather snapshots are cached separately under `data/historical/weather-cache`.

Files to know:

- Reusable odds snapshots: `data/historical/odds-cache/<season>/<snapshot-time>.json`
- Cache index for future model runs: `data/historical/odds-cache-manifest.json`
- Paid-call ledger: `data/historical/api-calls.jsonl`
- Latest web-app coverage report: `data/historical/import-report.json`

`data/historical/api-calls.jsonl` does not store the API key. It includes the season, snapshot time, requested markets, provider usage headers, credits spent, and cache path for each paid Odds API request.

Check cached coverage without spending Odds API quota:

```bash
npm run backtest:import -- --max-odds=0
```

Pull a controlled free historical weather batch without spending Odds API quota:

```bash
npm run backtest:import -- --max-odds=0 --max-weather=100
```

Fill all currently matched historical weather gaps without spending Odds API quota:

```bash
npm run backtest:import -- --max-odds=0 --max-weather=all
```

Pull a small paid historical odds batch:

```bash
npm run backtest:import -- --max-odds=100 --max-api-credits=3000
```

Pull one season at a time:

```bash
npm run backtest:import -- --seasons=2022 --max-odds=1000 --max-api-credits=30000
```

Pull cheaper moneyline-only historical odds after quota resets:

```bash
npm run backtest:import -- --seasons=2022 --markets=h2h --max-odds=1000 --max-api-credits=1000
```

Use the upgraded-plan budget carefully:

```bash
npm run backtest:import -- --max-odds=30000 --max-api-credits=60000
```

Important: The Odds API charges historical requests by market/region. The importer budgets full-market requests (`h2h`, `spreads`, `totals`) at 30 credits before each call, then records the provider's actual `x-requests-last` usage when available. The Backtest tab reports full-market versus moneyline-only snapshots, plus API requests made and credits spent. Rerunning the importer is cache-first: already cached snapshots are read from disk and do not call the Odds API again.

Export the called/matched games file:

```bash
npm run backtest:export-called-games
```

Default export files:

- `data/historical/exports/called-games.csv`
- `data/historical/exports/called-games-summary.json`
- `data/historical/exports/mlb-edge-called-games-export.zip`

## API Health

Useful endpoints:

- `GET /api/health`
- `GET /api/today?date=YYYY-MM-DD`
- `GET /api/data-health`
- `GET /api/odds/live-check`
- `GET /api/odds/historical-check?date=YYYY-MM-DDTHH:00:00Z`
- `GET /api/backtest/import-report`

Odds health responses include provider quota metadata when The Odds API returns it:

- `requestsRemaining`
- `requestsUsed`
- `requestsLast`

If remaining requests are `0`, do not run paid import batches until the plan resets or the account is upgraded.

## Deployment Notes

### Vercel

This repo includes:

- `vercel.json` for the Vite build output.
- `api/[...path].ts` so Vercel routes `/api/*` requests to the Express API.
- `src/server/import-report-snapshot.json` so the Backtest tab can show the latest non-secret import evidence even though `data/` is ignored.
- `.vercelignore` so local `.env` files, generated caches, logs, and build artifacts are not uploaded.

Project settings:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: `24.x`

Set these Vercel environment variables in the dashboard or CLI:

```bash
vercel env add ODDS_API_KEY production
vercel env add OPENAI_API_KEY production
vercel env add NWS_USER_AGENT production
```

Optional local Vercel flow:

```bash
vercel link
vercel env pull .env.local
vercel dev
```

Deploy:

```bash
vercel
vercel --prod
```

Important: Vercel serverless storage is ephemeral. The deployed app can read live APIs and serve the bundled import report snapshot, but durable self-improvement, grading history, and generated backtest caches need a hosted database/storage service before production use. Until then, local development remains the source of durable SQLite history under `data/`.

### Other Node Hosts

The app can also deploy to a Node host that supports:

- Build command: `npm run build`
- Start command: `npm start`
- Environment variables: `ODDS_API_KEY`, `OPENAI_API_KEY`, `NWS_USER_AGENT`

Good fits are Render, Railway, Fly.io, or any VPS/container host. Static-only hosts without API/serverless functions are not enough because the app needs API routes.

## Accuracy Rules

The app should stay honest:

- No fake today's games.
- No demo backtest promoted as proof.
- No high-success claim until five complete seasons have replayable odds, final scores, weather, park factors, and frozen pregame feature snapshots.
- Self-improvement should use graded outcomes and sample-size gates before changing thresholds.
- Every pick explanation should show why the model likes the side/total/run line and what inputs are missing or risky.
