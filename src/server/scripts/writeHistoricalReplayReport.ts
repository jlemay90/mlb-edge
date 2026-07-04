import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { writeHistoricalReplayReport } from "../historicalReplayReport.js";

const args = parseArgs(process.argv.slice(2));
const seasons = parseSeasons(args.seasons) ?? [2020, 2021, 2022, 2023, 2024, 2025];
const requiredSeasonCount =
  args.requiredSeasonCount === undefined ? 5 : Number(args.requiredSeasonCount);
const calledGamesCsvPath = resolve(
  process.cwd(),
  args.calledGames ?? "data/historical/exports/called-games.csv"
);
const outPath = resolve(process.cwd(), args.out ?? "data/historical/replay-report.json");
const snapshotOutPath =
  args.snapshotOut === "none"
    ? undefined
    : resolve(process.cwd(), args.snapshotOut ?? "src/server/replay-report-snapshot.json");

const report = await writeHistoricalReplayReport({
  calledGamesCsvPath,
  outPath,
  seasons,
  requiredSeasonCount: Number.isFinite(requiredSeasonCount) ? requiredSeasonCount : 5,
});

if (snapshotOutPath) {
  mkdirSync(dirname(snapshotOutPath), { recursive: true });
  writeFileSync(snapshotOutPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(
  JSON.stringify(
    {
      replayReportPath: outPath,
      snapshotOutPath,
      calledGamesCsvPath,
      seasons: report.seasons,
      status: report.status,
      completedSeasonCount: report.completedSeasonCount,
      requiredSeasonCount: report.requiredSeasonCount,
      summary: report.summary,
      topBlockers: report.blockers.slice(0, 12),
    },
    null,
    2
  )
);

function parseArgs(argv: string[]): {
  calledGames?: string;
  out?: string;
  snapshotOut?: string;
  seasons?: string;
  requiredSeasonCount?: string;
} {
  return Object.fromEntries(
    argv
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => {
        const [key, ...valueParts] = arg.slice(2).split("=");
        return [toCamelCase(key), valueParts.join("=")];
      })
  );
}

function parseSeasons(value: string | undefined): number[] | undefined {
  if (!value) {
    return undefined;
  }

  const seasons = value
    .split(",")
    .map((season) => Number(season.trim()))
    .filter((season) => Number.isInteger(season));

  return seasons.length > 0 ? seasons : undefined;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}
