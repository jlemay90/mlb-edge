import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { type FinalGameResult, type FinalGameStatus } from "../domain/grading";
import { runHistoricalBacktest, type HistoricalBacktestReport } from "../domain/historicalBacktest";
import { type HistoricalGameReplayInput } from "../domain/historicalReplay";
import { buildHistoricalSeasonReplay } from "../domain/historicalReplay";
import { type GameFeatures } from "../domain/projection";

type CalledGameCsvRow = Record<string, string | undefined>;

export type HistoricalReplayReportRequest = {
  calledGamesCsvPath: string;
  seasons: number[];
  requiredSeasonCount?: number;
};

export type WriteHistoricalReplayReportRequest = HistoricalReplayReportRequest & {
  outPath: string;
};

export async function buildHistoricalReplayReport(
  request: HistoricalReplayReportRequest
): Promise<HistoricalBacktestReport> {
  const calledGamesBySeason = loadCalledGamesCsv(request.calledGamesCsvPath);

  return runHistoricalBacktest({
    seasons: request.seasons,
    requiredSeasonCount: request.requiredSeasonCount,
    loadSeason: async (season) =>
      buildHistoricalSeasonReplay({
        season,
        games: calledGamesBySeason.get(season) ?? [],
      }),
  });
}

export async function writeHistoricalReplayReport(
  request: WriteHistoricalReplayReportRequest
): Promise<HistoricalBacktestReport> {
  const report = await buildHistoricalReplayReport(request);
  mkdirSync(dirname(request.outPath), { recursive: true });
  writeFileSync(request.outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export function loadCalledGamesCsv(path: string): Map<number, HistoricalGameReplayInput[]> {
  const rows = parseCsv(readFileSync(path, "utf8"));
  const bySeason = new Map<number, HistoricalGameReplayInput[]>();

  for (const row of rows) {
    const season = numberValue(row.season);
    if (season === undefined) {
      continue;
    }

    bySeason.set(season, [...(bySeason.get(season) ?? []), rowToReplayInput(row)]);
  }

  return bySeason;
}

function rowToReplayInput(row: CalledGameCsvRow): HistoricalGameReplayInput {
  const featureSnapshot = rowToFeatureSnapshot(row);

  return {
    date: featureSnapshot.date,
    gameId: featureSnapshot.gameId,
    featureSnapshot,
    finalResult: rowToFinalResult(row),
    oddsSnapshotAvailable: hasAnyOdds(featureSnapshot),
    weatherSnapshotAvailable: featureSnapshot.weatherRunImpact !== undefined,
    parkFactorAvailable: featureSnapshot.parkRunFactor !== undefined,
  };
}

function rowToFeatureSnapshot(row: CalledGameCsvRow): GameFeatures {
  return {
    gameId: textValue(row.gameId),
    date: textValue(row.officialDate) || textValue(row.gameDate).slice(0, 10),
    homeTeam: textValue(row.homeTeam),
    awayTeam: textValue(row.awayTeam),
    venueName: optionalText(row.venue),
    homeMoneyline: numberValue(row.homeMoneyline),
    awayMoneyline: numberValue(row.awayMoneyline),
    total: numberValue(row.total),
    overOdds: numberValue(row.overOdds),
    underOdds: numberValue(row.underOdds),
    runLine: numberValue(row.runLine),
    homeRunLineOdds: numberValue(row.homeRunLineOdds),
    awayRunLineOdds: numberValue(row.awayRunLineOdds),
    homeWrcPlus: numberValue(row.homeWrcPlus),
    awayWrcPlus: numberValue(row.awayWrcPlus),
    homeStarterFip: numberValue(row.homeStarterFip),
    awayStarterFip: numberValue(row.awayStarterFip),
    homeBullpenRest: numberValue(row.homeBullpenRest),
    awayBullpenRest: numberValue(row.awayBullpenRest),
    parkRunFactor: numberValue(row.parkRunFactor),
    parkFactorSource: optionalText(row.parkFactorSource),
    weatherRunImpact: numberValue(row.weatherRunImpact),
    homeLineupConfirmed: booleanValue(row.homeLineupConfirmed) ?? false,
    awayLineupConfirmed: booleanValue(row.awayLineupConfirmed) ?? false,
    homeRecentForm: numberValue(row.homeRecentForm),
    awayRecentForm: numberValue(row.awayRecentForm),
  };
}

function rowToFinalResult(row: CalledGameCsvRow): FinalGameResult | undefined {
  const status = finalStatus(row.status, row.homeScore, row.awayScore);
  if (!status) {
    return undefined;
  }

  return {
    gameId: textValue(row.gameId),
    status,
    homeTeam: textValue(row.homeTeam),
    awayTeam: textValue(row.awayTeam),
    homeScore: numberValue(row.homeScore),
    awayScore: numberValue(row.awayScore),
  };
}

function finalStatus(status: string | undefined, homeScore: string | undefined, awayScore: string | undefined): FinalGameStatus | undefined {
  const normalized = textValue(status).toLowerCase();
  if (normalized === "final" || normalized === "postponed" || normalized === "suspended" || normalized === "cancelled") {
    return normalized;
  }

  if (numberValue(homeScore) !== undefined && numberValue(awayScore) !== undefined) {
    return "final";
  }

  return undefined;
}

function parseCsv(content: string): CalledGameCsvRow[] {
  const records = parseCsvRecords(content).filter((record) => record.some((cell) => cell.trim().length > 0));
  const headers = records[0] ?? [];

  return records.slice(1).map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
  );
}

function parseCsvRecords(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]!;
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function hasAnyOdds(features: GameFeatures): boolean {
  return [
    features.homeMoneyline,
    features.awayMoneyline,
    features.total,
    features.overOdds,
    features.underOdds,
    features.runLine,
    features.homeRunLineOdds,
    features.awayRunLineOdds,
  ].some((value) => value !== undefined);
}

function textValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

function optionalText(value: string | undefined): string | undefined {
  const text = textValue(value);
  return text.length > 0 ? text : undefined;
}

function numberValue(value: string | undefined): number | undefined {
  const text = textValue(value);
  if (!text) {
    return undefined;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: string | undefined): boolean | undefined {
  const text = textValue(value).toLowerCase();
  if (text === "true" || text === "yes" || text === "1") {
    return true;
  }
  if (text === "false" || text === "no" || text === "0") {
    return false;
  }
  return undefined;
}
