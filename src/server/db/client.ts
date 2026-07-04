import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { SCHEMA_STATEMENTS } from "./schema.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: typeof DatabaseSyncType };

export type Db = DatabaseSyncType;

export function defaultDatabaseFilename(): string {
  return process.env.MLB_EDGE_DB_PATH ?? (process.env.VERCEL ? join(tmpdir(), "mlb-edge-lab.sqlite") : "data/mlb-edge-lab.sqlite");
}

export function createDatabase(filename = defaultDatabaseFilename()): Db {
  if (filename !== ":memory:") {
    mkdirSync(dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export function runMigrations(db: Db): void {
  db.exec("BEGIN");
  try {
    for (const statement of SCHEMA_STATEMENTS) {
      db.exec(statement);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
