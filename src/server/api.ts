import express, { type Express } from "express";
import { pathToFileURL } from "node:url";
import { summarizeBacktest, type BacktestPick } from "../domain/backtest";
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from "../domain/modelConfig";
import { createDatabase, runMigrations, type Db } from "./db/client";
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
};

export function createApp(dependencies: AppDependencies = {}): Express {
  const app = express();
  const db = dependencies.db ?? createDefaultDatabase();
  const config = dependencies.config ?? configFromEnv();
  const modelConfig = dependencies.modelConfig ?? DEFAULT_MODEL_CONFIG;

  saveModelVersion(db, modelConfig);

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, app: "MLB Edge Lab", modelVersion: getCurrentModelVersion(db).version });
  });

  app.get("/api/today", (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : todayIsoDate();
    res.json({
      date,
      picks: listPicksByDate(db, date),
      modelVersion: getCurrentModelVersion(db).version,
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

  return app;
}

function createDefaultDatabase(): Db {
  const db = createDatabase();
  runMigrations(db);
  return db;
}

function configFromEnv(): ApiRuntimeConfig {
  return {
    oddsApiKey: process.env.ODDS_API_KEY,
    openAiApiKey: process.env.OPENAI_API_KEY,
    nwsUserAgent: process.env.NWS_USER_AGENT,
  };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4000);
  createApp().listen(port, "127.0.0.1", () => {
    console.log(`MLB Edge Lab API listening on http://127.0.0.1:${port}`);
  });
}
