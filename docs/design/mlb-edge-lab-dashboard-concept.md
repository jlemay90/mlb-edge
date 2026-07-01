# MLB Edge Lab Dashboard Concept

## Concept Direction

Dense personal command-center dashboard for previewing the MLB model. The interface is not a sales page: it opens directly to the model workspace with a slate table, selected pick detail, parlay card, calibration evidence, backtest summary, and API health.

## Visual System

- Background: charcoal navy/black surfaces with thin low-contrast borders.
- Accents: teal for model probability and positive state, gold for odds/top-pick emphasis, red for risk/loss/drawdown.
- Radius: 6-8px for panels and controls.
- Typography: compact system sans, strong numeric weight, small uppercase labels for table metadata.
- Container model: fixed sidebar, compact header rails, data panels, tables, and metric strips. No marketing hero, no paywall modules, no nested decorative cards.

## Primary Screen Inventory

- Sidebar: MLB Edge Lab mark, Today, Parlays, Grading, Backtest, Model Lab, Data Health.
- Header: date, model version, API health indicators.
- Today panel: table of qualified picks with matchup, market, odds, model probability, edge, confidence.
- Pick detail: selected pick, projected score, probability vs market, key signals, warnings.
- Parlay panel: explainable parlay legs and combined edge.
- Backtest panel: ROI, win rate, units, drawdown, CLV.
- Model lab panel: calibration buckets and threshold recommendations.
- Data health rail: source status without showing secret key values.

## Interaction States

- Sidebar buttons switch dashboard views.
- Slate rows select a pick and update the pick detail panel.
- Parlay cards show leg reasoning and correlation warnings.
- Grading view shows postgame results from deterministic sample finals.
- Backtest and Model Lab views use the same seeded sample replay data.
