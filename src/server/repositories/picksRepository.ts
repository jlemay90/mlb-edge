import { type GradedPick, type PickGradeResult } from "../../domain/grading.js";
import { type Pick } from "../../domain/picks.js";
import { type GameFeatures, type GameProjection } from "../../domain/projection.js";
import { type Db } from "../db/client.js";
import type { SQLInputValue } from "node:sqlite";

export type PersistedPick = Pick & {
  result?: PickGradeResult;
  actualScore?: string;
  gradedAt?: string;
};

type PickRow = {
  id: string;
  date: string;
  game_id: string;
  market: Pick["market"];
  selection: Pick["selection"];
  label: string;
  odds: number;
  model_probability: number;
  implied_probability: number;
  edge: number;
  confidence_tier: Pick["confidenceTier"];
  model_version: string;
  feature_snapshot_json: string;
  projection_json: string;
  rationale_facts_json: string;
  result?: PickGradeResult;
  actual_score?: string;
  graded_at?: string;
};

export function savePickSnapshot(db: Db, pick: Pick): void {
  db.prepare(
    `INSERT INTO picks (
      id, date, game_id, market, selection, label, odds, model_probability,
      implied_probability, edge, confidence_tier, model_version,
      feature_snapshot_json, projection_json, rationale_facts_json
    )
    VALUES (
      @id, @date, @gameId, @market, @selection, @label, @odds, @modelProbability,
      @impliedProbability, @edge, @confidenceTier, @modelVersion,
      @featureSnapshotJson, @projectionJson, @rationaleFactsJson
    )
    ON CONFLICT(id) DO UPDATE SET
      odds = excluded.odds,
      model_probability = excluded.model_probability,
      implied_probability = excluded.implied_probability,
      edge = excluded.edge,
      feature_snapshot_json = excluded.feature_snapshot_json,
      projection_json = excluded.projection_json,
      rationale_facts_json = excluded.rationale_facts_json`
  ).run(toPickParams(pick));
}

export function listPicksByDate(db: Db, date: string): PersistedPick[] {
  return db
    .prepare("SELECT * FROM picks WHERE date = ? ORDER BY edge DESC")
    .all(date)
    .map((row) => fromPickRow(row as PickRow));
}

export function getPickById(db: Db, id: string): PersistedPick | null {
  const row = db.prepare("SELECT * FROM picks WHERE id = ?").get(id) as PickRow | undefined;
  return row ? fromPickRow(row) : null;
}

export function updatePickResult(db: Db, pickId: string, graded: GradedPick): void {
  db.prepare(
    `UPDATE picks
     SET result = @result, actual_score = @actualScore, graded_at = @gradedAt
     WHERE id = @pickId`
  ).run({
    pickId,
    result: graded.result,
    actualScore: graded.actualScore,
    gradedAt: new Date().toISOString(),
  });
}

function toPickParams(pick: Pick): Record<string, SQLInputValue> {
  return {
    id: pick.id,
    date: pick.date,
    gameId: pick.gameId,
    market: pick.market,
    selection: pick.selection,
    label: pick.label,
    odds: pick.odds,
    modelProbability: pick.modelProbability,
    impliedProbability: pick.impliedProbability,
    edge: pick.edge,
    confidenceTier: pick.confidenceTier,
    modelVersion: pick.modelVersion,
    featureSnapshotJson: JSON.stringify(pick.featureSnapshot),
    projectionJson: JSON.stringify(pick.projection),
    rationaleFactsJson: JSON.stringify(pick.rationaleFacts),
  };
}

function fromPickRow(row: PickRow): PersistedPick {
  return {
    id: row.id,
    gameId: row.game_id,
    date: row.date,
    market: row.market,
    selection: row.selection,
    label: row.label,
    odds: row.odds,
    modelProbability: row.model_probability,
    impliedProbability: row.implied_probability,
    edge: row.edge,
    confidenceTier: row.confidence_tier,
    modelVersion: row.model_version,
    featureSnapshot: JSON.parse(row.feature_snapshot_json) as GameFeatures,
    projection: JSON.parse(row.projection_json) as GameProjection,
    rationaleFacts: JSON.parse(row.rationale_facts_json) as string[],
    result: row.result,
    actualScore: row.actual_score,
    gradedAt: row.graded_at,
  };
}
