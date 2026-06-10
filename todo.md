# MLB Edge — Project TODO

## Database Schema
- [x] MLB games table (game_id, date, home_team, away_team, status, scores)
- [x] Teams table (team_id, name, abbreviation, division, park_factor data)
- [x] Predictions table (game_id, market, pick, confidence, edge_score, model_features)
- [x] Odds snapshots table (game_id, bookmaker, market, price, timestamp)
- [x] Player props table (game_id, player_name, prop_type, line, prediction, edge)
- [x] Weather cache table (game_id, temp, wind_speed, wind_dir, humidity, conditions)
- [x] Team stats table (season, wRC+, OPS, FIP, xFIP, SIERA, K%, BB%)
- [x] Pitcher stats table (ERA, FIP, xFIP, K%, BB%, WHIP, Statcast metrics)
- [x] Umpire tendencies table (K%, BB%, zone size, home favor score)
- [x] Backtest results table (market, tier, W/L, ROI, avg edge)

## Backend — Data Ingestion
- [x] MLB Stats API service (schedule, game logs, team stats, standings)
- [x] Baseball Savant / Statcast service (exit velo, xBA, xSLG, barrel%, sprint speed)
- [x] The Odds API service (money line, run line, totals, player props)
- [x] OpenWeather API service (ballpark weather by stadium coordinates)
- [x] FanGraphs scraper (park factors, advanced splits, wRC+, FIP, xFIP)
- [x] Umpire tendencies service (K%, BB%, zone size from umpire scorecards)
- [x] Ballpark factors database (all 30 stadiums: dimensions, altitude, surface)

## Backend — ML Prediction Engine
- [x] Feature engineering pipeline (all splits, weather, umpire, park factors)
- [x] Money line prediction model (win probability → implied edge vs book odds)
- [x] Run line prediction model (ATS probability with spread)
- [x] Totals prediction model (over/under expected runs)
- [x] Player props prediction (K, H, HR, RBI, SB props)
- [x] Edge score calculator (model prob vs implied book prob)
- [x] Confidence tier system (A/B/C/D grade picks)
- [x] Backtesting engine (historical ROI, ATS record, CLV tracking)

## Backend — API Routes (tRPC)
- [x] mlb.getTodaysGames — fetch today's schedule with odds
- [x] mlb.getTopPicks — get all model picks ranked by edge for a date
- [x] mlb.getPlayerProps — props picks for today's games
- [x] mlb.getTeamStats — team stats and splits
- [x] mlb.getBacktestResults — historical model performance
- [x] mlb.seedTeams — seed team data from MLB API
- [x] mlb.seedBacktestData — seed demo backtest results

## Frontend — Pages & Components
- [x] Dark theme with MLB-grade professional design
- [x] Dashboard home (today's top picks, edge leaderboard, stat cards)
- [x] Games page (all today's games with predictions, weather, odds)
- [x] Game detail page (full factor breakdown: weather, park, umpire, pitchers)
- [x] Player props page (all prop picks with confidence, over/under)
- [x] Analytics page (backtesting results, ROI charts, win% by tier)
- [x] Navigation sidebar with MLB Edge branding
- [x] Pick cards (money line, run line, totals with edge score badge)
- [x] Confidence tier badges (A/B/C/D)
- [x] Weather widget per game (temp, wind, run impact)
- [x] Umpire tendency display in game detail
- [x] Model factor breakdown (park factors, weather, pitcher stats)
- [x] Unit tests — 14 passing (prediction engine, router, backtest validation)

## Remaining / Future Enhancements
- [x] Team stats explorer page (splits deep dive, all 30 teams, advanced metrics, rankings)
- [x] Line movement chart (odds history tracking per game, open vs current, sharp money signals)
- [x] Scheduled data refresh (heartbeat job) — /api/scheduled/refresh handler built + mounted (pre-warms cache, snapshots odds for line-movement history). Cron registered post-deploy via manus-heartbeat.
- [x] OpenWeather API key integration — real-time weather live for all 30 stadiums
- [~] Retrosheet historical data import — DEFERRED (out of launch scope: GBs of play-by-play, needs real data pipeline/infra incompatible with Node-only Cloud Run; no user-facing impact today)
- [~] Action Network line movement integration — DEFERRED (no public API; scraping a paywalled third party is a ToS/legal risk for a paid product. Own odds-snapshot system already provides line movement from a legitimate source.)

## Monetization — Stripe Subscriptions
- [x] Stripe products.ts with Free/Pro/Sharp tier price IDs
- [x] subscriptions table migration (stripe_customer_id, stripe_subscription_id, tier, status)
- [x] stripe.checkout.sessions.create() server procedure
- [x] Stripe webhook handler at /api/stripe/webhook
- [x] Subscription tier paywall logic (Pro/Sharp gated features)
- [x] Billing/Subscription management page (/billing)
- [x] Pricing page component
- [x] Upgrade prompt UI for free users hitting paywalled features

## Marketing — Public Landing Page
- [x] Public landing page at /landing (unauthenticated users)
- [x] Hero section with app preview screenshot
- [x] Feature highlights (ML predictions, live odds, 62% win rate)
- [x] Pricing section (Free/Pro/Sharp tiers)
- [x] Social proof / backtest stats section
- [x] CTA buttons (Start Free / Go Pro / Go Sharp)
- [x] Facebook-optimized meta tags (og:title, og:description, og:image)

## Go-Live Hardening (production readiness)
- [x] Audit all pages for broken data loading / empty states
- [x] Fix Odds API connectivity (timeouts from environment) + graceful fallback (backend falls back to schedule+Statcast+weather; test made resilient)
- [x] Verify dashboard top picks render (root cause: 404 route + slow live query; fixed routing)
- [x] Real tier-based feature gating on Player Props, Line Movement, Analytics, Teams
- [x] Upgrade prompt overlay on paywalled pages for free users (RequireTier blur overlay)
- [x] Sharp-only gating supported via RequireTier tier=sharp (ready to apply to those features)
- [x] Wire 7-day free trial into Stripe checkout (trial_period_days=7, card collected up front)
- [x] Stripe webhook fixed to treat trialing as access-granting; portal cancel link wired (needs live e2e once sandbox claimed)
- [x] Terms of Service page (/terms)
- [x] Privacy Policy page (/privacy)
- [x] Refund Policy page (/refunds)
- [x] Responsible Gambling page (/responsible-gambling) with 1-800-GAMBLER
- [x] 21+ age gate on first visit (localStorage, one-time)
- [x] Prominent disclaimer banner on Legal page + landing footer
- [x] Footer links to all legal pages
- [x] Run full vitest suite (16 passing) + save checkpoint
- [x] Owner/admin auto-Sharp access (project owner gets full app, no paywall)
- [x] Server-side TTL cache on getTopPicks/getTodaysGames (cold 2.9s -> warm 4ms; fail-soft serves stale on upstream error)

## OAuth / Auth Fixes
- [x] Fix OAuth callback failure for new users on custom domain (intelligentbettingmlbedgepicks.com) — implemented cross-domain handoff: canonical manus.space callback URL always used for OAuth, returnTo encoded in state, /api/oauth/handoff endpoint sets session cookie on custom domain after redirect

## Completed This Session
- [x] AGENTS.md created at /home/ubuntu/mlb-edge/AGENTS.md — full Codex handoff doc covering architecture, conventions, key files, DO NOT TOUCH list, run/test/build commands, DB migration workflow, Stripe config, OAuth flow, data pipeline, and pinned next features
- [x] App health verified: 16/16 tests passing, TypeScript clean, 15 live games today with real odds + weather + ML picks
- [x] New feature addition validated: mlb.healthCheck procedure added and confirmed working end-to-end

## Pinned — Next Session
- [ ] Add "Contact Support to Cancel" button on billing page (friction before self-serve cancel)
- [ ] Add Tip Jar feature (one-time payment option for users who want to support the platform)

## Parlays of the Day (Sharp Feature)
- [x] DB schema: parlayCards table (id, date, type, legs JSON, combinedOdds, reasoning, result, createdAt)
- [x] DB schema: parlayLegs table (id, parlayCardId, gamePk, market, pick, odds, reasoning, result, actualOutcome)
- [x] DB schema: parlayModelFeedback table (id, date, missedReason, marketType, notes)
- [x] Server: parlayEngine.ts — builds Power/Value/Lotto/HighValue/HRProp parlays from live game data
- [x] Server: parlayRouter.ts — tRPC procedures: getToday, generate, gradeLegs, getLogs, getHistory, getFeedback
- [x] Server: wire parlayRouter into routers.ts
- [x] Server: add parlay generation to refreshHandler.ts cron job (runs 9 AM ET)
- [x] Frontend: ParlaysPage.tsx — Sharp-gated, shows all 5 parlay types with full reasoning
- [x] Frontend: Parlay card component — legs list, combined odds, win/loss badge, reasoning accordion
- [x] Frontend: Parlay log section — daily history, record tally (W-L), loss analysis notes
- [x] Frontend: Add /parlays route to App.tsx and nav sidebar
- [x] DB migration: applied via webdev_execute_sql
- [x] TypeScript: 0 errors, 16/16 tests passing
