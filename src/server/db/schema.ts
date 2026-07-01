export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS model_versions (
    version TEXT PRIMARY KEY,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS picks (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    game_id TEXT NOT NULL,
    market TEXT NOT NULL,
    selection TEXT NOT NULL,
    label TEXT NOT NULL,
    odds REAL NOT NULL,
    model_probability REAL NOT NULL,
    implied_probability REAL NOT NULL,
    edge REAL NOT NULL,
    confidence_tier TEXT NOT NULL,
    model_version TEXT NOT NULL,
    feature_snapshot_json TEXT NOT NULL,
    projection_json TEXT NOT NULL,
    rationale_facts_json TEXT NOT NULL,
    result TEXT,
    actual_score TEXT,
    graded_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS parlay_cards (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    combined_odds REAL NOT NULL,
    model_probability REAL NOT NULL,
    implied_probability REAL NOT NULL,
    edge REAL NOT NULL,
    warnings_json TEXT NOT NULL,
    result TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS parlay_legs (
    id TEXT PRIMARY KEY,
    parlay_card_id TEXT NOT NULL,
    pick_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    reasoning_json TEXT NOT NULL,
    result TEXT,
    FOREIGN KEY (parlay_card_id) REFERENCES parlay_cards(id),
    FOREIGN KEY (pick_id) REFERENCES picks(id)
  )`,
  `CREATE TABLE IF NOT EXISTS game_results (
    game_id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    raw_json TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS odds_snapshots (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    source TEXT NOT NULL,
    raw_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS calibration_snapshots (
    id TEXT PRIMARY KEY,
    model_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    summary_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS api_health (
    name TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    detail TEXT
  )`,
];
