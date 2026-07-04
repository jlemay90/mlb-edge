import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

async function requestText(app: ReturnType<typeof createApp>, path: string): Promise<string> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP address");
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    return await response.text();
  } finally {
    server.close();
  }
}

describe("persistence and API", () => {
  const dbs: Db[] = [];
  const tempDirs: string[] = [];

  afterEach(() => {
    while (dbs.length > 0) {
      dbs.pop()!.close();
    }
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { force: true, recursive: true });
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

  it("uses MLB_EDGE_DB_PATH for the default SQLite database path", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mlb-edge-db-"));
    tempDirs.push(tempDir);
    const dbPath = join(tempDir, "runtime.sqlite");
    const previous = process.env.MLB_EDGE_DB_PATH;
    process.env.MLB_EDGE_DB_PATH = dbPath;

    const db = createDatabase();
    try {
      expect(existsSync(dbPath)).toBe(true);
    } finally {
      db.close();
      if (previous === undefined) {
        delete process.env.MLB_EDGE_DB_PATH;
      } else {
        process.env.MLB_EDGE_DB_PATH = previous;
      }
    }
  });

  it("uses an ephemeral temp SQLite database path on Vercel", () => {
    const dbPath = join(tmpdir(), "mlb-edge-lab.sqlite");
    rmSync(dbPath, { force: true });
    const previousVercel = process.env.VERCEL;
    const previousDbPath = process.env.MLB_EDGE_DB_PATH;
    process.env.VERCEL = "1";
    delete process.env.MLB_EDGE_DB_PATH;

    const db = createDatabase();
    try {
      expect(existsSync(dbPath)).toBe(true);
    } finally {
      db.close();
      rmSync(dbPath, { force: true });
      if (previousVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = previousVercel;
      }
      if (previousDbPath === undefined) {
        delete process.env.MLB_EDGE_DB_PATH;
      } else {
        process.env.MLB_EDGE_DB_PATH = previousDbPath;
      }
    }
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
      scheduleProvider: async () => ({ ok: true, data: [] }),
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

  it("returns live schedule games on the today endpoint without inventing picks", async () => {
    const db = migratedDb();
    dbs.push(db);
    const app = createApp({
      db,
      scheduleProvider: async (date) => ({
        ok: true,
        data: [
          {
            gameId: "824174",
            gameDate: `${date}T20:10:00-04:00`,
            status: "scheduled",
            awayTeam: "Minnesota Twins",
            homeTeam: "Houston Astros",
            venue: "Daikin Park",
          },
        ],
      }),
    });

    const today = (await request(app, "/api/today?date=2026-07-01")) as {
      games: Array<{ awayTeam: string; homeTeam: string; venue?: string }>;
      picks: Pick[];
    };

    expect(today.games).toEqual([
      expect.objectContaining({
        awayTeam: "Minnesota Twins",
        homeTeam: "Houston Astros",
        venue: "Daikin Park",
      }),
    ]);
    expect(today.picks).toEqual([]);
  });

  it("exposes historical backtest readiness without claiming unverified success", async () => {
    const db = migratedDb();
    dbs.push(db);
    const tempDir = mkdtempSync(join(tmpdir(), "mlb-edge-no-replay-"));
    tempDirs.push(tempDir);
    const app = createApp({
      db,
      config: {
        oddsApiKey: "odds-secret-value",
        openAiApiKey: "openai-secret-value",
        nwsUserAgent: "mlb-edge-lab/test",
      },
      historicalReplayReportPath: join(tempDir, "missing-replay-report.json"),
      historicalReplayReportFallbackPath: join(tempDir, "missing-replay-snapshot.json"),
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

  it("serves a cached historical replay report when one is available", async () => {
    const db = migratedDb();
    dbs.push(db);
    const tempDir = mkdtempSync(join(tmpdir(), "mlb-edge-replay-report-"));
    tempDirs.push(tempDir);
    const replayReportPath = join(tempDir, "replay-report.json");
    writeFileSync(
      replayReportPath,
      JSON.stringify({
        seasons: [2021, 2022, 2023, 2024, 2025],
        requiredSeasonCount: 5,
        completedSeasonCount: 4,
        status: "partial",
        summary: {
          totalPicks: 42,
          record: { wins: 23, losses: 17, pushes: 2, voids: 0 },
          winRate: 0.575,
          unitsStaked: 42,
          profitUnits: 3.12,
          roi: 0.0743,
          averageOdds: -106,
          averageEdge: 0.061,
          maxDrawdownUnits: 2.4,
          clv: { count: 0, missing: true },
        },
        coverage: [],
        blockers: ["2021: 2 games are missing imported feature snapshots."],
        canClaimHighSuccessRate: false,
      })
    );
    const app = createApp({
      db,
      historicalReplayReportPath: replayReportPath,
    } as Parameters<typeof createApp>[0] & { historicalReplayReportPath: string });

    const historical = (await request(app, "/api/backtest/historical?asOf=2026-07-01")) as {
      status: string;
      summary: { totalPicks: number; roi: number };
      blockers: string[];
    };

    expect(historical.status).toBe("partial");
    expect(historical.summary.totalPicks).toBe(42);
    expect(historical.summary.roi).toBe(0.0743);
    expect(historical.blockers.join(" ")).not.toContain("ODDS_API_KEY is missing");
  });

  it("uses cached historical replay coverage for historical odds health instead of calling the paid API", async () => {
    const db = migratedDb();
    dbs.push(db);
    const tempDir = mkdtempSync(join(tmpdir(), "mlb-edge-replay-report-"));
    tempDirs.push(tempDir);
    const replayReportPath = join(tempDir, "replay-report.json");
    writeFileSync(
      replayReportPath,
      JSON.stringify({
        seasons: [2024, 2025],
        requiredSeasonCount: 2,
        completedSeasonCount: 2,
        status: "verified",
        summary: {
          totalPicks: 9,
          record: { wins: 5, losses: 4, pushes: 0, voids: 0 },
          winRate: 0.5556,
          unitsStaked: 9,
          profitUnits: 0.73,
          roi: 0.0811,
          averageOdds: -108,
          averageEdge: 0.052,
          maxDrawdownUnits: 1,
          clv: { count: 0, missing: true },
        },
        coverage: [
          { season: 2024, oddsSnapshots: 123, complete: true },
          { season: 2025, oddsSnapshots: 456, complete: true },
        ],
        blockers: [],
        canClaimHighSuccessRate: true,
      })
    );
    const app = createApp({
      db,
      historicalReplayReportPath: replayReportPath,
      historicalOddsHealthCheck: async () => {
        throw new Error("paid historical endpoint should not be called");
      },
    } as Parameters<typeof createApp>[0] & { historicalReplayReportPath: string });

    const health = (await request(app, "/api/odds/historical-check")) as {
      ok: boolean;
      eventCount: number;
      snapshotDate: string;
      source: string;
    };

    expect(health).toMatchObject({
      ok: true,
      eventCount: 579,
      snapshotDate: "cached replay",
      source: "cached-replay-report",
    });
  });

  it("checks historical odds access without returning the API key", async () => {
    const db = migratedDb();
    dbs.push(db);
    const tempDir = mkdtempSync(join(tmpdir(), "mlb-edge-no-replay-"));
    tempDirs.push(tempDir);
    const app = createApp({
      db,
      config: {
        oddsApiKey: "odds-secret-value",
      },
      historicalReplayReportPath: join(tempDir, "missing-replay-report.json"),
      historicalReplayReportFallbackPath: join(tempDir, "missing-replay-snapshot.json"),
      historicalOddsHealthCheck: async (_apiKey, snapshotDate) => ({
        configured: true,
        ok: true,
        checkedAt: "2026-07-01T00:00:00Z",
        snapshotDate,
        eventCount: 12,
      }),
    });

    const health = (await request(app, "/api/odds/historical-check?date=2025-07-01T16:00:00Z")) as {
      configured: boolean;
      ok: boolean;
      eventCount: number;
      snapshotDate: string;
    };
    const responseText = JSON.stringify(health);

    expect(health).toMatchObject({
      configured: true,
      ok: true,
      eventCount: 12,
      snapshotDate: "2025-07-01T16:00:00Z",
    });
    expect(responseText).not.toContain("odds-secret-value");
  });

  it("checks live odds access without returning the API key", async () => {
    const db = migratedDb();
    dbs.push(db);
    const app = createApp({
      db,
      config: {
        oddsApiKey: "odds-secret-value",
      },
      liveOddsHealthCheck: async (_apiKey) => ({
        configured: true,
        ok: true,
        checkedAt: "2026-07-01T00:00:00Z",
        eventCount: 14,
      }),
    });

    const health = (await request(app, "/api/odds/live-check")) as {
      configured: boolean;
      ok: boolean;
      eventCount: number;
    };
    const responseText = JSON.stringify(health);

    expect(health).toMatchObject({
      configured: true,
      ok: true,
      eventCount: 14,
    });
    expect(responseText).not.toContain("odds-secret-value");
  });

  it("serves the built web app from the API process for production deploys", async () => {
    const db = migratedDb();
    dbs.push(db);
    const staticDir = mkdtempSync(join(tmpdir(), "mlb-edge-dist-"));
    tempDirs.push(staticDir);
    writeFileSync(join(staticDir, "index.html"), "<!doctype html><title>MLB Edge Lab</title><main>built app</main>");
    const app = createApp({ db, staticDir });

    const html = await requestText(app, "/");

    expect(html).toContain("MLB Edge Lab");
    expect(html).toContain("built app");
  });

  it("serves a bundled import report fallback when local historical data is absent", async () => {
    const db = migratedDb();
    dbs.push(db);
    const tempDir = mkdtempSync(join(tmpdir(), "mlb-edge-report-"));
    tempDirs.push(tempDir);
    const missingReportPath = join(tempDir, "missing-import-report.json");
    const fallbackReportPath = join(tempDir, "snapshot-import-report.json");
    writeFileSync(
      fallbackReportPath,
      JSON.stringify({
        generatedAt: "2026-07-04T00:00:00.000Z",
        seasons: [2020, 2021],
        oddsApiConfigured: true,
        requestedMarkets: ["h2h"],
        maxOddsSnapshots: 0,
        maxWeatherSnapshots: 0,
        totals: { games: 1, featureDrafts: 1, weatherSnapshotsCached: 1 },
        seasonReports: [],
        blockers: [],
      })
    );
    const app = createApp({ db, importReportPath: missingReportPath, importReportFallbackPath: fallbackReportPath });

    const report = (await request(app, "/api/backtest/import-report")) as {
      seasons: number[];
      totals: { featureDrafts: number };
    };

    expect(report.seasons).toEqual([2020, 2021]);
    expect(report.totals.featureDrafts).toBe(1);
  });
});
