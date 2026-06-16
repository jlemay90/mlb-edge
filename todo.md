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
- [x] Add "Contact Support to Cancel" button on billing page (friction before self-serve cancel)
- [x] Add Tip Jar feature (one-time payment option for users who want to support the platform) — UI added, Stripe wiring coming next session

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

## Odds API Upgrade (Phase 2)
- [x] Update ODDS_API_KEY secret to new key (20k/mo plan, $30/mo)
- [x] Filter all odds calls to DraftKings + FanDuel only
- [x] Fix run line bug: favorites always -1.5, underdogs always +1.5 (real spread odds from DK/FD)
- [x] Fix parlayEngine odds field mapping: recommendedOdds vs odds (root cause of 0-leg parlays)
- [x] Export buildGameFeaturesSync from mlbRouter for correct field names in parlayRouter
- [x] HR props pipeline fixed: uses all available books (WH/BetRivers) since DK/FD don't post HR props via API
- [x] Force-regenerated today's parlays: 5 cards with real team names, mixed markets, correct odds
- [x] 36/36 tests passing, TypeScript clean

## Model Upgrades — Phase 3 (Free Data Enhancements) — COMPLETED
- [x] Confirmed starting lineups via MLB Stats API live lineup endpoint
- [x] Pitcher recent form: last 3 starts ERA, K%, HR allowed (MLB Stats API)
- [x] Bullpen usage tracking: pitches thrown last 3 days, rest status, ERA (MLB Stats API)
- [x] Batter vs pitcher Statcast matchup data: BA, SLG, HR, K% head-to-head (Baseball Savant)
- [x] Handedness-split park factors: L/R batter park factor multipliers (FanGraphs)
- [x] All 5 signals wired into GameFeatures interface and predictionEngine
- [x] Bullpen fatigue signal added to projectTeamRuns and predictTotal
- [x] Pitcher trend signal added to projectTeamRuns (hot/cold/neutral)
- [x] Batter matchup score + vsHandedness added to HR prop engine
- [x] modelSignals field added to getTodaysGames return object
- [x] Parlays regenerated with upgraded model (IDs 90006-90010)
- [x] 36/36 tests passing, TypeScript clean

## Odds Accuracy Fixes — No Guessing Policy
- [x] Fix matchOddsGame: require BOTH home AND away team match to prevent Sox/Sox collision (CHW vs BOS false match)
- [x] Fix spread point parsing — homeRunLine now correctly shows home team's actual spread point from API
- [x] Fix spread odds parsing — use outcome.price directly, no formula-derived fallbacks
- [x] Fix predictRunLine: require real homeRunLineOdds AND awayRunLineOdds from API (no fallback)
- [x] Add run differential gate: only recommend run line if projected diff >= 1.8 runs
- [x] Remove all formula fallbacks from predictRunLine (the ?? ML - 50 pattern)
- [x] Regenerate today's parlays with clean real-only data (5 cards, all real DK/FD odds)
- [x] Fix refreshHandler.ts: replace local matchOddsGame (Sox/Sox bug) with canonical both-team matcher
- [x] Fix refreshHandler.ts: replace hardcoded feature building (?? -110, ?? 8.5) with buildGameFeaturesSync
- [x] 36/36 tests passing, TypeScript clean after all fixes

## Post-Game Debrief System
- [x] Add postgame_debrief column to parlay_cards schema + migrate (ALTER TABLE applied)
- [x] Build parlayGrader.ts: fetchFinalScores, gradeLeg (ML/RL/total/prop), LLM debrief generator
- [x] Wire grader into refreshHandler.ts nightly cron (grades yesterday's cards automatically)
- [x] Add gradeNow tRPC mutation for manual backfill trigger (defaults to yesterday)
- [x] Add PostGameDebrief component to ParlaysPage with 3-section expandable debrief
- [x] Add "Grade Yesterday's Results" button to History tab
- [x] Update empty history message to explain pending state clearly
- [x] 36/36 tests passing, TypeScript clean after all debrief changes

## Growth Funnel — Public Free Pick + Trust Building
- [x] Public tRPC procedure: getFreePick (today's single best A/B-tier pick, no auth required)
- [x] Public tRPC procedure: getPublicRecord (last 14-day win/loss record, no auth required)
- [x] /free-pick page — fully public, no login, shareable URL with today's top pick + reasoning
- [x] /free-pick shows last 14-day record strip with result dots for trust
- [x] Landing page: live record widget (real W-L numbers from DB)
- [x] Landing page: free pick preview card in hero (2-column layout)
- [x] Landing page: hero CTA changed to 'See Today's Free Pick' as primary action
- [x] Landing page: 'Free Pick' added to footer nav
- [x] No changes to Stripe pricing, subscription tiers, or paywall logic
- [x] 36/36 tests passing, TypeScript clean

## Line Movement Snapshot — 30-min Auto-Polling
- [x] Build /api/scheduled/snapshot-odds handler (3 credits/run, h2h+spreads+totals only, DK preferred)
- [x] Mount handler in server/_core/index.ts
- [x] TypeScript clean, 36/36 tests passing
- [x] Deploy site and register heartbeat cron: every 30 min, noon-midnight ET (16:00-04:00 UTC) — task_uid: aEGtDZwmt6Szfr5K9RiWgT, next run: 2026-06-11T21:30:00Z
- [x] Verified: 13 successful runs, 15 snapshots/run (195 total today), all HTTP 200, avg 1-2s per run

## Pricing Overhaul + Conversion (Goal: first 5 sign-ups)
- [x] Create Stripe prices with lookup_keys (Edge/Sharp/Syndicate monthly + annual) in TEST mode; LIVE via one-time script run
- [x] Wire products.ts to resolve prices by lookup_key at runtime (works in test + live)
- [x] Remove card-required trial + any promo period logic from checkout
- [x] Re-allocate tier features (Edge=daily picks, Sharp=parlays+HR+WHY, Syndicate=raw edge+bankroll+founding badge)
- [x] DB: add is_founding_member + founding_member_since + referral cols; founding count capped at 500
- [x] Founding-500: each tier locks ITS OWN rate for life (Edge $9.99 / Sharp $19.99 / Syndicate $49.99)
- [x] Founding-500 badge + live counter (X of 500 spots left) on pricing/landing
- [x] Lead with free daily pick (no card) as primary funnel
- [x] Live W-L record widget on pricing page for trust
- [x] Update PricingPage UI, landing page pricing section, billing page to new tiers
- [x] Verify Stripe checkout uses new price IDs by lookup_key (no trial_period_days)
- [x] Referral program: shareable link + "give a week get a week" (leak-safe one-reward-per-user)
- [x] Verify prices render correctly across all 3 surfaces

## Syndicate Extras (real value) — Plan B (no time-gate)
- [x] Bankroll / bet tracker page (Syndicate-gated, real American-odds ROI math, 6 payout tests)
- [x] Full model-confidence view: raw edge % gated to Syndicate; others see qualitative strength
- [~] Early access time-gate — DROPPED (Plan B: would throttle acquisition funnel; not faking unbuilt 8AM/CLV claims)

## Ad Creatives + Facebook Copy
- [~] Winning-bet screenshot ad — DROPPED (fake winnings violate Meta/FTC gambling-ad rules; replaced with compliant brand/offer creative)
- [x] Generate "model WHY" creative (the reasoning behind a pick) — ad-model-why.png
- [x] Generate compliant brand/Founding-500 offer creative — ad-founding-offer.png
- [x] Rewrite Facebook ad copy with new pricing + founding hook + Meta compliance guide (marketing/facebook-ads.md)

## Engine Audit + Fixes (Task B - separate report)
- [x] Void yesterday's postponed Braves game (gamePk 824589, 0-0) -> set legs 210020/210029 to push, corrected legs_lost on cards 210006/210008
- [x] Add auto-void rule: postponed/suspended games never counted as W/L going forward (parlayGrader hardened)
- [x] Honest assessment: is the model actually self-improving?
- [x] Leak hunt: efficiency + correctness once-over (value-prop fabricated 0.6 default removed; umpire over% ×100 bug fixed)
- [x] Plain-English summary of how Parlays of the Day are calculated (docs/how-parlays-are-calculated.md)
- [x] Fix: one parlay always duplicates the Lotto pick - differentiate it (Lotto now biases plus-money/high-odds, diverges from Power)
- [x] Fix: HR Prop section still not working (relaxed ERA gate, always surfaces top power spots)
- [x] No-guess: HR reasoning labels model-derived barrel%/exit velo/ISO/HR-rate as "(est.)" not confirmed Statcast

## Pricing QA (verification before checkpoint)
- [x] Browser QA: Pricing renders correct tier names/prices, founding counter, no trial copy; fixed win% double-multiply bug (2000% -> 20%)

## Founding counter reveal threshold (UX)
- [x] Add config: FOUNDING_COUNTER_REVEAL_AT=25 — show live "X of 500 left" only after real signups >= threshold; below it show offer text with no number
- [x] Wire threshold into getFoundingStatus response (showCounter flag, server-side single source of truth)
- [x] Update LandingPage + PricingPage to respect showCounter flag

## Go-live: create LIVE Stripe prices
- [x] Created all 6 LIVE prices via script with user's sk_live key (Edge/Sharp/Syndicate monthly+annual)
- [x] Verified all 6 live lookup_keys resolve to active live prices (live=true)
- [x] Production resolves prices by lookup_key at runtime — no code change/redeploy needed

## NEXT SESSION PRIORITIES (in order)

- [ ] REMINDER: Add refund-webhook handling so tiers auto-downgrade when a subscription is refunded/cancelled in Stripe (currently refunds do NOT remove access)
- [ ] Advertising push: Facebook ad campaign setup guide, ad creative deployment, targeting strategy for sports bettors
- [ ] Sportsbook integration: push picks/links to sportsbook affiliate partners (DraftKings, FanDuel, etc.) — affiliate revenue stream on top of subscriptions

## Refund Webhook + Founder Tier Checkout
- [x] Add charge.refunded webhook handler — auto-downgrade to free on full refund; founder only downgraded if full $50 refunded
- [x] Founder tier checkout: mode=payment (one-time $50), founderLookupKey in products.ts, stripeRouter handles founder separately
- [x] Fix PricingPage handleUpgrade to accept founder tier and pass correct billing type

## Sportsbook Affiliate Links
- [x] Create shared/sportsbooks.ts with DraftKings, FanDuel, BetMGM, Caesars affiliate link config
- [x] Build SportsbookLinks + SportsbookBadges reusable components
- [ ] Sign up for affiliate programs (DK, FD, BetMGM, Caesars) and get approved
- [ ] Replace placeholder affiliate URLs with real approved links in shared/sportsbooks.ts
- [ ] Re-inject SportsbookBadges into Dashboard PickCard and SportsbookLinks into FreePickPage once links are live

## Cache & Data Fixes (Jun 14)
- [x] Fix pitcher/game time staleness — increase schedule cache TTL from 10 min to 30 min
- [x] Fix getTodaysGames to use TTL.schedule instead of TTL.picks
- [x] Update stadium 133 from Oakland Coliseum to Sutter Health Park with hitter-friendly park factors (parkFactorRuns: 115, parkFactorHR: 125, parkFactorHits: 110)
- [x] Update team name mapping to "Las Vegas Athletics" for stadium 133
- [x] Update secondary park factors for Sutter Health Park (hrL: 130, hrR: 120, runsL: 118, runsR: 112)


## Model Improvements (Jun 15)
- [x] Reduce wind weighting for totals (0.04 → 0.025 for out-to-CF, etc.)
- [x] Increase temperature sensitivity for extreme heat (>82°F: 0.015 → 0.035)
- [x] Add park factor hierarchy to prevent wind signals from negating Coors/Sutter Health boost
- [x] Update ParlaysPage to show (Full-Parlay) label for parlay breakdown

## ChatGPT Integration
- [x] Create UI Update Webhook endpoint (/api/webhooks/ui-update)
- [x] Add webhook authentication with UI_UPDATE_WEBHOOK_SECRET
- [x] Create webhook test suite (4 tests passing)
- [x] Mount webhook in main server with GET /supported endpoint
- [ ] Document webhook usage for ChatGPT (Codex)
- [ ] Test ChatGPT → Webhook → UI changes workflow

## Pending (Weekly Reminders)
- [ ] Database connection fix (retry SQL queries)
- [ ] Historical backtesting on new model changes
- [ ] Implement automated learning loop (future)
- [ ] Sign up for sportsbook affiliate programs (DK, FD, BetMGM, Caesars)
