import express, { type Express } from "express";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { summarizeBacktest, type BacktestPick } from "../domain/backtest";
import { buildHistoricalBacktestReadiness } from "../domain/historicalBacktest";
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from "../domain/modelConfig";
import { createDatabase, runMigrations, type Db } from "./db/client";
import { loadLocalEnv } from "./env";
import { type HistoricalImportReport } from "./historicalImport";
import {
  checkHistoricalOddsAccess,
  checkLiveOddsAccess,
  type HistoricalOddsHealthCheck,
  type LiveOddsHealthCheck,
} from "./oddsHealth";
import { fetchMlbSchedule, type MlbScheduledGame, type ProviderResult } from "./providers/mlbStats";
import { getCurrentModelVersion, saveModelVersion } from "./repositories/modelRepository";
import { getPickById, listPicksByDate, updatePickResult } from "./repositories/picksRepository";

export type ApiRuntimeConfig = {
  oddsApiKey?: string;
  openAiApiKey?: string;
  nwsUserAgent?: string;
};

export type AppDependencies = {
  db?: Db;
  config?: ApiRuntimeConfig;
  modelConfig?: ModelConfig;
  historicalOddsHealthCheck?: HistoricalOddsHealthCheck;
  liveOddsHealthCheck?: LiveOddsHealthCheck;
  scheduleProvider?: (date: string) => Promise<ProviderResult<MlbScheduledGame[]>>;
  staticDir?: string;
  importReportPath?: string;
  importReportFallbackPath?: string;
};

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();
  const db = dependencies.db ?? createDefaultDatabase();
  const config = dependencies.config ?? configFromEnv();
  const modelConfig = dependencies.modelConfig ?? DEFAULT_MODEL_CONFIG;
  const historicalOddsHealthCheck = dependencies.historicalOddsHealthCheck ?? checkHistoricalOddsAccess;
  const liveOddsHealthCheck = dependencies.liveOddsHealthCheck ?? checkLiveOddsAccess;
  const scheduleProvider = dependencies.scheduleProvider ?? fetchMlbSchedule;
  const staticDir = dependencies.staticDir ?? resolve(process.cwd(), "dist");
  const importReportPath =
    dependencies.importReportPath ?? resolve(process.cwd(), "data/historical/import-report.json");
  const importReportFallbackPath =
    dependencies.importReportFallbackPath ?? resolve(process.cwd(), "src/server/import-report-snapshot.json");

  saveModelVersion(db, modelConfig);

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, app: "MLB Edge Lab", modelVersion: getCurrentModelVersion(db).version });
  });

  app.get("/api/today", async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : todayIsoDate();
    const schedule = await scheduleProvider(date);

    res.json({
      date,
      games: schedule.ok ? schedule.data : [],
      picks: listPicksByDate(db, date),
      modelVersion: getCurrentModelVersion(db).version,
      scheduleError: schedule.ok ? undefined : schedule.error,
    });
  });

  app.get("/api/picks/:id", (req, res) => {
    const pick = getPickById(db, req.params.id);
    if (!pick) {
      res.status(404).json({ error: "Pick not found" });
      return;
    }

    res.json({ pick });
  });

  app.get("/api/parlays", (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : todayIsoDate();
    res.json({ date, parlays: [] });
  });

  app.post("/api/grade", (req, res) => {
    const { pickId, graded } = req.body as { pickId?: string; graded?: Parameters<typeof updatePickResult>[2] };
    if (!pickId || !graded) {
      res.status(400).json({ error: "pickId and graded are required" });
      return;
    }

    updatePickResult(db, pickId, graded);
    res.json({ ok: true, pick: getPickById(db, pickId) });
  });

  app.post("/api/backtest", (req, res) => {
    const picks = ((req.body as { picks?: BacktestPick[] }).picks ?? []) as BacktestPick[];
    res.json({ summary: summarizeBacktest(picks) });
  });

  app.get("/api/backtest/historical", (req, res) => {
    const asOfDateIso = typeof req.query.asOf === "string" ? req.query.asOf : todayIsoDate();

    try {
      res.json(
        buildHistoricalBacktestReadiness({
          asOfDateIso,
          oddsApiConfigured: Boolean(config.oddsApiKey?.trim()),
        })
      );
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid historical backtest request" });
    }
  });

  app.get("/api/backtest/import-report", (_req, res) => {
    const reportPath = existsSync(importReportPath) ? importReportPath : importReportFallbackPath;
    if (!existsSync(reportPath)) {
      res.status(404).json({
        error: "No historical import report found. Run npm run backtest:import first.",
      });
      return;
    }

    res.json(JSON.parse(readFileSync(reportPath, "utf8")) as HistoricalImportReport);
  });

  app.get("/api/odds/historical-check", async (req, res) => {
    const snapshotDate =
      typeof req.query.date === "string" ? req.query.date : "2025-07-01T16:00:00Z";
    const apiKey = config.oddsApiKey ?? "";

    try {
      res.json(await historicalOddsHealthCheck(apiKey, snapshotDate));
    } catch (error) {
      res.status(502).json({
        configured: Boolean(apiKey.trim()),
        ok: false,
        checkedAt: new Date().toISOString(),
        snapshotDate,
        eventCount: 0,
        error: error instanceof Error ? error.message : "Historical odds check failed.",
      });
    }
  });

  app.get("/api/odds/live-check", async (_req, res) => {
    const apiKey = config.oddsApiKey ?? "";

    try {
      res.json(await liveOddsHealthCheck(apiKey));
    } catch (error) {
      res.status(502).json({
        configured: Boolean(apiKey.trim()),
        ok: false,
        checkedAt: new Date().toISOString(),
        eventCount: 0,
        error: error instanceof Error ? error.message : "Live odds check failed.",
      });
    }
  });

  app.get("/api/model", (_req, res) => {
    res.json({
      current: getCurrentModelVersion(db),
      versions: [getCurrentModelVersion(db)],
    });
  });

  app.post("/api/model/adopt-thresholds", (_req, res) => {
    res.status(409).json({
      error: "Threshold adoption is disabled until calibration evidence is persisted with sample-size gates.",
    });
  });

  app.get("/api/data-health", (_req, res) => {
    res.json({
      sources: [
        {
          name: "MLB Stats API",
          status: "available",
          requiresKey: false,
        },
        {
          name: "The Odds API",
          status: config.oddsApiKey?.trim() ? "configured" : "missing",
          requiresKey: true,
        },
        {
          name: "National Weather Service",
          status: config.nwsUserAgent?.trim() ? "configured" : "missing-user-agent",
          requiresKey: false,
        },
        {
          name: "Open-Meteo",
          status: "available-fallback",
          requiresKey: false,
        },
        {
          name: "OpenAI",
          status: config.openAiApiKey?.trim() ? "configured" : "missing",
          requiresKey: true,
        },
      ],
    });
  });

  installStaticFrontend(app, staticDir);

  return app;
}

function createDefaultDatabase(): Db {
  const db = createDatabase();
  runMigrations(db);
  return db;
}

function configFromEnv(): ApiRuntimeConfig {
  loadLocalEnv();

  return {
    oddsApiKey: process.env.ODDS_API_KEY,
    openAiApiKey: process.env.OPENAI_API_KEY,
    nwsUserAgent: process.env.NWS_USER_AGENT,
  };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function installStaticFrontend(app: Express, staticDir: string): void {
  const indexPath = resolve(staticDir, "index.html");
  if (!existsSync(indexPath)) {
    return;
  }

  app.use(express.static(staticDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(indexPath);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";
  createApp().listen(port, host, () => {
    console.log(`MLB Edge Lab API listening on http://${host}:${port}`);
  });
}
