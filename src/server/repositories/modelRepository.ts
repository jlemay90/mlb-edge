import { DEFAULT_MODEL_CONFIG, type ModelConfig } from "../../domain/modelConfig.js";
import { type Db } from "../db/client.js";

type ModelRow = {
  config_json: string;
};

export function saveModelVersion(db: Db, config: ModelConfig): void {
  db.prepare(
    `INSERT INTO model_versions (version, config_json, created_at)
     VALUES (@version, @configJson, @createdAt)
     ON CONFLICT(version) DO UPDATE SET config_json = excluded.config_json`
  ).run({
    version: config.version,
    configJson: JSON.stringify(config),
    createdAt: new Date().toISOString(),
  });
}

export function listModelVersions(db: Db): ModelConfig[] {
  return db
    .prepare("SELECT config_json FROM model_versions ORDER BY created_at DESC")
    .all()
    .map((row) => parseModelConfig(row as ModelRow));
}

export function getCurrentModelVersion(db: Db): ModelConfig {
  return listModelVersions(db)[0] ?? DEFAULT_MODEL_CONFIG;
}

function parseModelConfig(row: ModelRow): ModelConfig {
  return JSON.parse(row.config_json) as ModelConfig;
}
