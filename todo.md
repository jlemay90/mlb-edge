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
- [ ] Team stats explorer page (splits deep dive)
- [ ] Line movement chart (odds history over time)
- [ ] Scheduled data refresh (heartbeat job)
- [ ] OpenWeather API key integration (currently using MLB weather data)
- [ ] Retrosheet historical data import for deeper backtesting
- [ ] Action Network line movement integration
