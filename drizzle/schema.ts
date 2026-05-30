import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  boolean,
  json,
  date,
  index,
} from "drizzle-orm/mysql-core";

// ─── Core Auth ────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Stripe subscription fields
  stripeCustomerId: varchar("stripeCustomerId", { length: 100 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 100 }),
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "pro", "sharp"]).default("free").notNull(),
  subscriptionStatus: varchar("subscriptionStatus", { length: 30 }).default("active"),
  subscriptionPeriodEnd: timestamp("subscriptionPeriodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── MLB Teams ────────────────────────────────────────────────────────────────

export const mlbTeams = mysqlTable("mlb_teams", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("teamId").notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 10 }).notNull(),
  shortName: varchar("shortName", { length: 50 }),
  division: varchar("division", { length: 50 }),
  league: varchar("league", { length: 10 }),
  venue: varchar("venue", { length: 100 }),
  // Park factors (100 = neutral)
  parkFactorRuns: float("parkFactorRuns").default(100),
  parkFactorHR: float("parkFactorHR").default(100),
  parkFactorHits: float("parkFactorHits").default(100),
  // Stadium coordinates for weather
  stadiumLat: float("stadiumLat"),
  stadiumLon: float("stadiumLon"),
  stadiumAltitudeFt: int("stadiumAltitudeFt"),
  // Surface type
  surface: varchar("surface", { length: 20 }).default("grass"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MlbTeam = typeof mlbTeams.$inferSelect;

// ─── MLB Games ────────────────────────────────────────────────────────────────

export const mlbGames = mysqlTable(
  "mlb_games",
  {
    id: int("id").autoincrement().primaryKey(),
    gamePk: int("gamePk").notNull().unique(),
    gameDate: date("gameDate").notNull(),
    gameTime: varchar("gameTime", { length: 20 }),
    status: varchar("status", { length: 30 }).default("scheduled"),
    homeTeamId: int("homeTeamId").notNull(),
    awayTeamId: int("awayTeamId").notNull(),
    homeTeamName: varchar("homeTeamName", { length: 100 }),
    awayTeamName: varchar("awayTeamName", { length: 100 }),
    homeScore: int("homeScore"),
    awayScore: int("awayScore"),
    inning: int("inning"),
    venue: varchar("venue", { length: 100 }),
    // Starting pitchers
    homePitcherId: int("homePitcherId"),
    awayPitcherId: int("awayPitcherId"),
    homePitcherName: varchar("homePitcherName", { length: 100 }),
    awayPitcherName: varchar("awayPitcherName", { length: 100 }),
    // Umpire
    umpireId: int("umpireId"),
    umpireName: varchar("umpireName", { length: 100 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_game_date").on(t.gameDate)]
);

export type MlbGame = typeof mlbGames.$inferSelect;

// ─── Odds Snapshots ───────────────────────────────────────────────────────────

export const oddsSnapshots = mysqlTable(
  "odds_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    gamePk: int("gamePk").notNull(),
    bookmaker: varchar("bookmaker", { length: 50 }).notNull(),
    market: mysqlEnum("market", ["h2h", "spreads", "totals", "player_props"]).notNull(),
    homePrice: int("homePrice"), // American odds e.g. -150
    awayPrice: int("awayPrice"),
    spread: float("spread"),
    total: float("total"),
    overPrice: int("overPrice"),
    underPrice: int("underPrice"),
    snapshotAt: timestamp("snapshotAt").defaultNow().notNull(),
  },
  (t) => [index("idx_odds_game").on(t.gamePk)]
);

export type OddsSnapshot = typeof oddsSnapshots.$inferSelect;

// ─── Weather Cache ────────────────────────────────────────────────────────────

export const weatherCache = mysqlTable("weather_cache", {
  id: int("id").autoincrement().primaryKey(),
  gamePk: int("gamePk").notNull().unique(),
  tempF: float("tempF"),
  feelsLikeF: float("feelsLikeF"),
  windSpeedMph: float("windSpeedMph"),
  windDirDeg: int("windDirDeg"),
  windDirLabel: varchar("windDirLabel", { length: 20 }), // "Out to CF", "In from CF", etc.
  humidity: int("humidity"),
  conditions: varchar("conditions", { length: 100 }),
  precipChance: float("precipChance"),
  // Derived impact
  runImpact: float("runImpact").default(0), // +/- expected runs adjustment
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
});

export type WeatherCache = typeof weatherCache.$inferSelect;

// ─── Umpire Tendencies ────────────────────────────────────────────────────────

export const umpireTendencies = mysqlTable("umpire_tendencies", {
  id: int("id").autoincrement().primaryKey(),
  umpireName: varchar("umpireName", { length: 100 }).notNull().unique(),
  // Strike zone tendencies
  strikeZoneSize: float("strikeZoneSize").default(1.0), // relative to avg
  kPctAboveAvg: float("kPctAboveAvg").default(0), // +/- vs league avg
  bbPctAboveAvg: float("bbPctAboveAvg").default(0),
  // Favor scores
  homeFavorScore: float("homeFavorScore").default(0), // + = favors home
  pitcherFavorScore: float("pitcherFavorScore").default(0), // + = favors pitcher
  // Historical stats
  gamesUmpired: int("gamesUmpired").default(0),
  avgRunsPerGame: float("avgRunsPerGame"),
  overPct: float("overPct"), // % of games that went over total
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UmpireTendency = typeof umpireTendencies.$inferSelect;

// ─── Team Stats (Season) ──────────────────────────────────────────────────────

export const teamStats = mysqlTable(
  "team_stats",
  {
    id: int("id").autoincrement().primaryKey(),
    teamId: int("teamId").notNull(),
    season: int("season").notNull(),
    // Offense
    runsPerGame: float("runsPerGame"),
    wrcPlus: float("wrcPlus"),
    ops: float("ops"),
    obp: float("obp"),
    slg: float("slg"),
    avg: float("avg"),
    iso: float("iso"),
    babip: float("babip"),
    kPct: float("kPct"),
    bbPct: float("bbPct"),
    hrPerGame: float("hrPerGame"),
    // Defense
    era: float("era"),
    fip: float("fip"),
    xfip: float("xfip"),
    whip: float("whip"),
    kPer9: float("kPer9"),
    bbPer9: float("bbPer9"),
    hrPer9: float("hrPer9"),
    // Splits
    runsPerGameHome: float("runsPerGameHome"),
    runsPerGameAway: float("runsPerGameAway"),
    eraHome: float("eraHome"),
    eraAway: float("eraAway"),
    runsPerGameVsL: float("runsPerGameVsL"),
    runsPerGameVsR: float("runsPerGameVsR"),
    // Win/Loss
    wins: int("wins").default(0),
    losses: int("losses").default(0),
    winPct: float("winPct"),
    lastTenW: int("lastTenW").default(0),
    lastTenL: int("lastTenL").default(0),
    streak: int("streak").default(0), // + = win streak, - = loss streak
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_team_season").on(t.teamId, t.season)]
);

export type TeamStat = typeof teamStats.$inferSelect;

// ─── Pitcher Stats ────────────────────────────────────────────────────────────

export const pitcherStats = mysqlTable(
  "pitcher_stats",
  {
    id: int("id").autoincrement().primaryKey(),
    playerId: int("playerId").notNull(),
    playerName: varchar("playerName", { length: 100 }).notNull(),
    teamId: int("teamId"),
    season: int("season").notNull(),
    // Core stats
    era: float("era"),
    fip: float("fip"),
    xfip: float("xfip"),
    siera: float("siera"),
    whip: float("whip"),
    kPer9: float("kPer9"),
    bbPer9: float("bbPer9"),
    hrPer9: float("hrPer9"),
    kPct: float("kPct"),
    bbPct: float("bbPct"),
    kMinusBBPct: float("kMinusBBPct"),
    // Statcast
    avgExitVeloAllowed: float("avgExitVeloAllowed"),
    barrelPctAllowed: float("barrelPctAllowed"),
    hardHitPctAllowed: float("hardHitPctAllowed"),
    xba: float("xba"),
    xslg: float("xslg"),
    xwoba: float("xwoba"),
    // Splits
    eraVsL: float("eraVsL"),
    eraVsR: float("eraVsR"),
    eraHome: float("eraHome"),
    eraAway: float("eraAway"),
    eraFirst3Inn: float("eraFirst3Inn"),
    // Arsenal
    primaryPitch: varchar("primaryPitch", { length: 30 }),
    fastballVelo: float("fastballVelo"),
    spinRate: float("spinRate"),
    // Recent form
    last3GamesEra: float("last3GamesEra"),
    last5GamesEra: float("last5GamesEra"),
    daysSinceLastStart: int("daysSinceLastStart"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_pitcher_season").on(t.playerId, t.season)]
);

export type PitcherStat = typeof pitcherStats.$inferSelect;

// ─── Predictions ──────────────────────────────────────────────────────────────

export const predictions = mysqlTable(
  "predictions",
  {
    id: int("id").autoincrement().primaryKey(),
    gamePk: int("gamePk").notNull(),
    gameDate: date("gameDate").notNull(),
    market: mysqlEnum("market", ["moneyline", "runline", "total", "prop"]).notNull(),
    pick: varchar("pick", { length: 100 }).notNull(), // "home", "away", "over", "under", player name
    pickLabel: varchar("pickLabel", { length: 200 }), // human readable
    modelProbability: float("modelProbability").notNull(), // 0-1
    impliedProbability: float("impliedProbability"), // from book odds
    edgeScore: float("edgeScore"), // modelProb - impliedProb
    confidenceTier: mysqlEnum("confidenceTier", ["A", "B", "C", "D"]).default("C"),
    recommendedOdds: int("recommendedOdds"), // American odds
    // Feature snapshot
    features: json("features"), // key model inputs
    // Outcome tracking
    result: mysqlEnum("result", ["win", "loss", "push", "pending"]).default("pending"),
    actualScore: varchar("actualScore", { length: 20 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_pred_game").on(t.gamePk),
    index("idx_pred_date").on(t.gameDate),
  ]
);

export type Prediction = typeof predictions.$inferSelect;

// ─── Player Props ─────────────────────────────────────────────────────────────

export const playerProps = mysqlTable(
  "player_props",
  {
    id: int("id").autoincrement().primaryKey(),
    gamePk: int("gamePk").notNull(),
    gameDate: date("gameDate").notNull(),
    playerId: int("playerId"),
    playerName: varchar("playerName", { length: 100 }).notNull(),
    teamId: int("teamId"),
    propType: varchar("propType", { length: 50 }).notNull(), // "strikeouts", "hits", "home_runs", etc.
    line: float("line").notNull(),
    overOdds: int("overOdds"),
    underOdds: int("underOdds"),
    modelProjection: float("modelProjection"),
    pick: mysqlEnum("pick", ["over", "under", "pass"]).default("pass"),
    edgeScore: float("edgeScore"),
    confidenceTier: mysqlEnum("confidenceTier", ["A", "B", "C", "D"]).default("C"),
    keyFactors: json("keyFactors"),
    result: mysqlEnum("result", ["win", "loss", "push", "pending"]).default("pending"),
    actualValue: float("actualValue"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_props_game").on(t.gamePk)]
);

export type PlayerProp = typeof playerProps.$inferSelect;

// ─── Backtesting Results ──────────────────────────────────────────────────────

export const backtestResults = mysqlTable("backtest_results", {
  id: int("id").autoincrement().primaryKey(),
  market: varchar("market", { length: 30 }).notNull(),
  confidenceTier: varchar("confidenceTier", { length: 5 }),
  season: int("season"),
  totalPicks: int("totalPicks").default(0),
  wins: int("wins").default(0),
  losses: int("losses").default(0),
  pushes: int("pushes").default(0),
  winPct: float("winPct"),
  roi: float("roi"), // return on investment %
  avgEdge: float("avgEdge"),
  avgOdds: float("avgOdds"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BacktestResult = typeof backtestResults.$inferSelect;
