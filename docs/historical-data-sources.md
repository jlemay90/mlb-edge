# Historical data sources

The five-season backtest must use imported historical replay data, not the seeded dashboard preview.

## Required signals

- MLB final results and statuses from MLB Stats API schedule data.
- Historical odds snapshots from The Odds API historical endpoint.
- Historical weather from Open-Meteo archive data.
- Park run factors from a park-factor source such as Baseball Savant Statcast park factors.
- Feature snapshots that combine odds, weather, park factors, team offense, starters, bullpen/rest, lineup, and recent form at the decision time.

## API keys

- `ODDS_API_KEY`: required for historical odds. Historical odds are paid-plan data at The Odds API.
- `OPENAI_API_KEY`: optional for narrative/debrief generation only; deterministic WHY text must still work without it.
- `NWS_USER_AGENT`: required for live National Weather Service forecast calls.

Put real values in a local `.env` file only. Do not commit `.env`, API keys, or copied secret values.

## Current replay behavior

`/api/backtest/historical?asOf=YYYY-MM-DD` reports readiness for the most recent completed seasons. As of `2026-07-01`, the target window is `2021-2025`.

The status remains `blocked` until every target season has complete imported snapshots for odds, final results, weather, park factors, and feature inputs. The app should not claim high success rate from preview data.
