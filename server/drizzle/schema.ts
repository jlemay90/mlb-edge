import { int, mysqlTable, varchar, float, date, datetime, boolean, json } from "drizzle-orm/mysql-core";

export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  mlbTeamId: int("mlb_team_id").notNull().unique(),
  name: varchar("name", { length: 50 }),
  abbreviation: varchar("abbreviation", { length: 3 }),
  division: varchar("division", { length: 20 }),
  league: varchar("league", { length: 2 }),
  parkFactorRun: float("park_factor_run"),
  parkFactorHr: float("park_factor_hr"),
  updatedAt: datetime("updated_at").defaultNow(),
});

export const games = mysqlTable("games", {
  id: int("id").autoincrement().primaryKey(),
  gamePk: int("game_pk").notNull().unique(),
  gameDate: date("game_date").notNull(),
  homeTeamId: int("home_team_id").notNull(),
  awayTeamId: int("away_team_id").notNull(),
  homeStarterId: int("home_starter_id"),
  awayStarterId: int("away_starter_id"),
  homePlateUmpireId: int("home_plate_umpire_id"),
  weatherTemp: int("weather_temp"),
  weatherCondition: varchar("weather_condition", { length: 30 }),
  windSpeed: int("wind_speed"),
  windDirection: varchar("wind_direction", { length: 10 }),
  isNightGame: boolean("is_night_game").default(false),
  status: varchar("status", { length: 20 }).default("scheduled"),
  homeScore: int("home_score"),
  awayScore: int("away_score"),
  homeOdds: int("home_odds"),
  awayOdds: int("away_odds"),
  overUnder: float("over_under"),
  createdAt: datetime("created_at").defaultNow(),
});

export const players = mysqlTable("players", {
  id: int("id").autoincrement().primaryKey(),
  mlbPlayerId: int("mlb_player_id").unique(),
  chadwickId: varchar("chadwick_id", { length: 20 }),
  name: varchar("name", { length: 100 }),
  teamId: int("team_id"),
  position: varchar("position", { length: 10 }),
  bats: varchar("bats", { length: 1 }),
  throws: varchar("throws", { length: 1 }),
  updatedAt: datetime("updated_at").defaultNow(),
});

export const predictions = mysqlTable("predictions", {
  id: int("id").autoincrement().primaryKey(),
  gameId: int("game_id").notNull(),
  market: varchar("market", { length: 20 }).notNull(),
  side: varchar("side", { length: 20 }),
  modelVersion: varchar("model_version", { length: 20 }).notNull(),
  predictedProb: float("predicted_prob").notNull(),
  confidenceTier: varchar("confidence_tier", { length: 10 }),
  edge: float("edge"),
  fairOdds: int("fair_odds"),
  marketOdds: int("market_odds"),
  recommendedUnit: float("recommended_unit"),
  featuresUsed: json("features_used"),
  result: varchar("result", { length: 10 }),
  createdAt: datetime("created_at").defaultNow(),
});

export const bankrollSnapshots = mysqlTable("bankroll_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  date: date("date").notNull(),
  startingBalance: float("starting_balance"),
  dailyPnl: float("daily_pnl"),
  cumulativeRoi: float("cumulative_roi"),
  sharpeRatio: float("sharpe_ratio"),
  maxDrawdown: float("max_drawdown"),
  tierAHitRate: float("tier_a_hit_rate"),
  totalBets: int("total_bets"),
});

export type Team = typeof teams.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type BankrollSnapshot = typeof bankrollSnapshots.$inferSelect;
