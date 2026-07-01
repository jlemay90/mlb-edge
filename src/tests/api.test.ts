import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_MODEL_CONFIG } from "../domain/modelConfig";
import { analyzeGame, type Pick } from "../domain/picks";
import { type GameFeatures } from "../domain/projection";
import { gradePick } from "../domain/grading";
import { createApp } from "../server/api";
import { createDatabase, runMigrations, type Db } from "../server/db/client";
import { listModelVersions, saveModelVersion } from "../server/repositories/modelRepository";
import {
  getPickById,
  listPicksByDate,
  savePickSnapshot,
  updatePickResult,
} from "../server/repositories/picksRepository";

function game(overrides: Partial<GameFeatures> = {}): GameFeatures {
  return {
    gameId: "game-1",
    date: "2026-07-01",
    homeTeam: "Home Club",
    awayTeam: "Away Club",
    homeMoneyline: -105,
    awayMoneyline: -105,
    total: 8,
    overOdds: -110,
    underOdds: -110,
    runLine: -1.5,
    homeRunLineOdds: 155,
    awayRunLineOdds: -180,
    homeWrcPlus: 128,
    awayWrcPlus: 86,
    homeStarterFip: 3.05,
    awayStarterFip: 5.25,
    homeBullpenRest: 82,
    awayBullpenRest: 42,
    parkRunFactor: 106,
    weatherRunImpact: 0.4,
    homeLineupConfirmed: true,
    awayLineupConfirmed: false,
    homeRecentForm: 1.4,
    awayRecentForm: -0.8,
    ...overrides,
  };
}

function pick(): Pick {
  return analyzeGame(game()).picks[0]!;
}

function migratedDb(): Db {
  const db = createDatabase(":memory:");
  runMigrations(db);
  return db;
}

async function request(app: ReturnType<typeof createApp>, path: string): Promise<unknown> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP address");
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    return await response.json();
  } finally {
    server.close();
  }
}

describe("persistence and API", () => {
  const dbs: Db[] = [];

  afterEach(() => {
    while (dbs.length > 0) {
      dbs.pop()!.close();
    }
  });

  it("runs migrations for model, pick, parlay, result, odds, calibration, and health tables", () => {
    const db = migratedDb();
    dbs.push(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        "model_versions",
        "picks",
        "parlay_cards",
        "parlay_legs",
        "game_results",
        "odds_snapshots",
        "calibration_snapshots",
        "api_health",
      ])
    );
  });

  it("persists model versions and generated pick snapshots", () => {
    const db = migratedDb();
    dbs.push(db);
    const generated = pick();

    saveModelVersion(db, DEFAULT_MODEL_CONFIG);
    savePickSnapshot(db, generated);

    expect(listModelVersions(db)[0]).toMatchObject({
      version: DEFAULT_MODEL_CONFIG.version,
      thresholds: DEFAULT_MODEL_CONFIG.thresholds,
    });

    const persisted = listPicksByDate(db, generated.date)[0]!;
    expect(persisted.id).toBe(generated.id);
    expect(persisted.featureSnapshot.homeWrcPlus).toBe(128);
    expect(persisted.projection.projectedTotal).toBeGreaterThan(0);
  });

  it("updates grading result fields for saved picks", () => {
    const db = migratedDb();
    dbs.push(db);
    const generated = pick();
    const graded = gradePick(generated, {
      gameId: generated.gameId,
      status: "final",
      homeTeam: generated.featureSnapshot.homeTeam,
      awayTeam: generated.featureSnapshot.awayTeam,
      homeScore: 7,
      awayScore: 2,
    });

    savePickSnapshot(db, generated);
    updatePickResult(db, generated.id, graded);

    const persisted = getPickById(db, generated.id)!;
    expect(persisted.result).toBe(graded.result);
    expect(persisted.actualScore).toContain("Home Club 7");
  });

  it("exposes local app data and never returns secret key values", async () => {
    const db = migratedDb();
    dbs.push(db);
    const generated = pick();
    saveModelVersion(db, DEFAULT_MODEL_CONFIG);
    savePickSnapshot(db, generated);

    const app = createApp({
      db,
      config: {
        oddsApiKey: "odds-secret-value",
        openAiApiKey: "openai-secret-value",
        nwsUserAgent: "mlb-edge-lab/test",
      },
    });

    const today = (await request(app, "/api/today?date=2026-07-01")) as { picks: Pick[] };
    const model = (await request(app, "/api/model")) as { current: { version: string } };
    const health = await request(app, "/api/data-health");
    const healthText = JSON.stringify(health);

    expect(today.picks[0]!.id).toBe(generated.id);
    expect(model.current.version).toBe(DEFAULT_MODEL_CONFIG.version);
    expect(healthText).toContain("configured");
    expect(healthText).not.toContain("odds-secret-value");
    expect(healthText).not.toContain("openai-secret-value");
  });

  it("exposes historical backtest readiness without claiming unverified success", async () => {
    const db = migratedDb();
    dbs.push(db);
    const app = createApp({
      db,
      config: {
        oddsApiKey: "odds-secret-value",
        openAiApiKey: "openai-secret-value",
        nwsUserAgent: "mlb-edge-lab/test",
      },
    });

    const historical = (await request(app, "/api/backtest/historical?asOf=2026-07-01")) as {
      seasons: number[];
      status: string;
      summary: { totalPicks: number };
      canClaimHighSuccessRate: boolean;
      blockers: string[];
    };
    const responseText = JSON.stringify(historical);

    expect(historical.seasons).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(historical.status).toBe("blocked");
    expect(historical.summary.totalPicks).toBe(0);
    expect(historical.canClaimHighSuccessRate).toBe(false);
    expect(historical.blockers.join(" ")).toContain("imported historical replay data");
    expect(responseText).not.toContain("odds-secret-value");
    expect(responseText).not.toContain("openai-secret-value");
  });
});
