import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildHistoricalReplayReport,
  loadCalledGamesCsv,
  writeHistoricalReplayReport,
} from "../server/historicalReplayReport";

describe("historical replay report", () => {
  it("loads called-games CSV rows into replay-ready game inputs grouped by season", () => {
    const dir = mkdtempSync(join(tmpdir(), "mlb-edge-replay-"));
    const csvPath = join(dir, "called-games.csv");
    writeFileSync(
      csvPath,
      [
        "season,gameId,officialDate,awayTeam,homeTeam,awayScore,homeScore,homeMoneyline,awayMoneyline,total,overOdds,underOdds,runLine,homeRunLineOdds,awayRunLineOdds,homeWrcPlus,awayWrcPlus,homeStarterFip,awayStarterFip,homeBullpenRest,awayBullpenRest,parkRunFactor,weatherRunImpact,homeRecentForm,awayRecentForm,missingSignals",
        "2025,game-1,2025-07-01,Away Club,Home Club,2,7,-105,-105,8,-110,-110,-1.5,155,-180,132,84,3.05,5.25,82,42,106,0.4,1.4,-0.8,confirmed lineups",
      ].join("\n"),
      "utf8"
    );

    const seasons = loadCalledGamesCsv(csvPath);
    const game = seasons.get(2025)?.[0];

    expect(game).toMatchObject({
      date: "2025-07-01",
      gameId: "game-1",
      finalResult: {
        status: "final",
        homeTeam: "Home Club",
        awayTeam: "Away Club",
        homeScore: 7,
        awayScore: 2,
      },
      oddsSnapshotAvailable: true,
      weatherSnapshotAvailable: true,
      parkFactorAvailable: true,
    });
    expect(game?.featureSnapshot?.homeStarterFip).toBe(3.05);
    expect(game?.featureSnapshot?.weatherRunImpact).toBe(0.4);
    expect(game?.featureSnapshot?.homeLineupConfirmed).toBe(false);
  });

  it("treats invalid American odds as missing so cached replay math stays finite", () => {
    const dir = mkdtempSync(join(tmpdir(), "mlb-edge-replay-"));
    const csvPath = join(dir, "called-games.csv");
    writeFileSync(
      csvPath,
      [
        "season,gameId,officialDate,awayTeam,homeTeam,awayScore,homeScore,homeMoneyline,awayMoneyline,total,overOdds,underOdds,runLine,homeRunLineOdds,awayRunLineOdds,homeWrcPlus,awayWrcPlus,homeStarterFip,awayStarterFip,homeBullpenRest,awayBullpenRest,parkRunFactor,weatherRunImpact,homeRecentForm,awayRecentForm,missingSignals",
        "2025,game-1,2025-07-01,Away Club,Home Club,2,7,-1,1200,8,-110,0,-1.5,99,-180,132,84,3.05,5.25,82,42,106,0.4,1.4,-0.8,invalid odds",
      ].join("\n"),
      "utf8"
    );

    const game = loadCalledGamesCsv(csvPath).get(2025)?.[0];

    expect(game?.featureSnapshot?.homeMoneyline).toBeUndefined();
    expect(game?.featureSnapshot?.awayMoneyline).toBeUndefined();
    expect(game?.featureSnapshot?.underOdds).toBeUndefined();
    expect(game?.featureSnapshot?.homeRunLineOdds).toBeUndefined();
  });

  it("uses scheduled first-pitch date for replay slate grouping when official date is later", () => {
    const dir = mkdtempSync(join(tmpdir(), "mlb-edge-replay-"));
    const csvPath = join(dir, "called-games.csv");
    writeFileSync(
      csvPath,
      [
        "season,gameId,officialDate,gameDate,awayTeam,homeTeam,awayScore,homeScore,homeMoneyline,awayMoneyline,total,overOdds,underOdds,runLine,homeRunLineOdds,awayRunLineOdds,homeWrcPlus,awayWrcPlus,homeStarterFip,awayStarterFip,homeBullpenRest,awayBullpenRest,parkRunFactor,weatherRunImpact,homeRecentForm,awayRecentForm,missingSignals",
        "2023,game-1,2023-09-01,2023-04-05T16:35:00Z,Away Club,Home Club,2,7,-105,-105,8,-110,-110,-1.5,155,-180,132,84,3.05,5.25,82,42,106,0.4,1.4,-0.8,confirmed lineups",
      ].join("\n"),
      "utf8"
    );

    const game = loadCalledGamesCsv(csvPath).get(2023)?.[0];

    expect(game?.date).toBe("2023-04-05");
    expect(game?.featureSnapshot?.date).toBe("2023-04-05");
  });

  it("builds an actual replay report from called-games CSV rows", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mlb-edge-replay-"));
    const csvPath = join(dir, "called-games.csv");
    writeFileSync(
      csvPath,
      [
        "season,gameId,officialDate,awayTeam,homeTeam,awayScore,homeScore,homeMoneyline,awayMoneyline,total,overOdds,underOdds,runLine,homeRunLineOdds,awayRunLineOdds,homeWrcPlus,awayWrcPlus,homeStarterFip,awayStarterFip,homeBullpenRest,awayBullpenRest,parkRunFactor,weatherRunImpact,homeRecentForm,awayRecentForm,missingSignals",
        "2025,game-1,2025-07-01,Away Club,Home Club,2,7,-105,-105,8,-110,-110,-1.5,155,-180,132,84,3.05,5.25,82,42,106,0.4,1.4,-0.8,confirmed lineups",
      ].join("\n"),
      "utf8"
    );

    const report = await buildHistoricalReplayReport({
      calledGamesCsvPath: csvPath,
      seasons: [2025],
      requiredSeasonCount: 1,
    });

    expect(report.seasons).toEqual([2025]);
    expect(report.status).toBe("verified");
    expect(report.completedSeasonCount).toBe(1);
    expect(report.summary.totalPicks).toBeGreaterThan(0);
    expect(report.coverage[0]).toMatchObject({
      season: 2025,
      complete: true,
      featureSnapshots: 1,
      finalResults: 1,
      oddsSnapshots: 1,
      weatherSnapshots: 1,
      parkFactors: 1,
    });
    expect(typeof report.canClaimHighSuccessRate).toBe("boolean");
  });

  it("writes replay report JSON for API and deploy snapshots", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mlb-edge-replay-"));
    const csvPath = join(dir, "called-games.csv");
    const outPath = join(dir, "replay-report.json");
    writeFileSync(
      csvPath,
      [
        "season,gameId,officialDate,awayTeam,homeTeam,awayScore,homeScore,homeMoneyline,awayMoneyline,total,overOdds,underOdds,runLine,homeRunLineOdds,awayRunLineOdds,homeWrcPlus,awayWrcPlus,homeStarterFip,awayStarterFip,homeBullpenRest,awayBullpenRest,parkRunFactor,weatherRunImpact,homeRecentForm,awayRecentForm,missingSignals",
        "2025,game-1,2025-07-01,Away Club,Home Club,2,7,-105,-105,8,-110,-110,-1.5,155,-180,132,84,3.05,5.25,82,42,106,0.4,1.4,-0.8,confirmed lineups",
      ].join("\n"),
      "utf8"
    );

    const report = await writeHistoricalReplayReport({
      calledGamesCsvPath: csvPath,
      outPath,
      seasons: [2025],
      requiredSeasonCount: 1,
    });

    expect(existsSync(outPath)).toBe(true);
    expect(JSON.parse(readFileSync(outPath, "utf8"))).toMatchObject({
      status: "verified",
      summary: {
        totalPicks: report.summary.totalPicks,
      },
    });
  });
});
