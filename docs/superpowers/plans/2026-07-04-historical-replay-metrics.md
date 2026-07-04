# Historical Replay Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the cached historical called-games export into an actual season-by-season backtest report with scored picks, ROI, win rate, coverage, and calibration inputs.

**Architecture:** Add a small server-side replay module that parses the exported called-games CSV into `HistoricalGameReplayInput` records, groups them by season, runs the existing `buildHistoricalSeasonReplay` and `runHistoricalBacktest` domain functions, and writes a reusable JSON report. The API will prefer that JSON report when present and fall back to readiness/blocker output when it is absent.

**Tech Stack:** TypeScript, Vitest, existing Express API, existing `domain/backtest`, `domain/historicalReplay`, and `domain/historicalBacktest` modules.

---

### Task 1: Historical Called-Games Loader

**Files:**
- Create: `src/server/historicalReplayReport.ts`
- Test: `src/tests/historicalReplayReport.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCalledGamesCsv } from "../server/historicalReplayReport";

describe("historical replay report", () => {
  it("loads called-games CSV rows into replay-ready game inputs grouped by season", () => {
    const dir = mkdtempSync(join(tmpdir(), "mlb-edge-replay-"));
    const csv = join(dir, "called-games.csv");
    writeFileSync(
      csv,
      [
        "season,gameId,officialDate,awayTeam,homeTeam,awayScore,homeScore,homeMoneyline,awayMoneyline,total,overOdds,underOdds,runLine,homeRunLineOdds,awayRunLineOdds,homeWrcPlus,awayWrcPlus,homeStarterFip,awayStarterFip,homeBullpenRest,awayBullpenRest,parkRunFactor,weatherRunImpact,homeRecentForm,awayRecentForm,missingSignals",
        "2025,game-1,2025-07-01,Away Club,Home Club,2,7,-105,-105,8,-110,-110,-1.5,155,-180,132,84,3.05,5.25,82,42,106,0.4,1.4,-0.8,confirmed lineups",
      ].join("\\n")
    );

    const seasons = loadCalledGamesCsv(csv);

    expect(seasons.get(2025)?.[0]).toMatchObject({
      date: "2025-07-01",
      gameId: "game-1",
      finalResult: {
        status: "final",
        homeScore: 7,
        awayScore: 2,
      },
      oddsSnapshotAvailable: true,
      weatherSnapshotAvailable: true,
      parkFactorAvailable: true,
    });
    expect(seasons.get(2025)?.[0]?.featureSnapshot?.homeStarterFip).toBe(3.05);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/historicalReplayReport.test.ts`

Expected: FAIL because `../server/historicalReplayReport` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/server/historicalReplayReport.ts` with:
- `loadCalledGamesCsv(path): Map<number, HistoricalGameReplayInput[]>`
- A small CSV row parser that handles quotes.
- Numeric conversion helpers that return `undefined` for blank values.
- Lineup confirmation defaults set to `false` when the only missing signal is confirmed lineups, because historical confirmed lineup timing is unavailable and the existing projection treats false as no bonus rather than fabricated confirmation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/tests/historicalReplayReport.test.ts`

Expected: PASS.

### Task 2: Replay Report Builder and CLI

**Files:**
- Modify: `src/server/historicalReplayReport.ts`
- Create: `src/server/scripts/runHistoricalReplay.ts`
- Modify: `package.json`
- Test: `src/tests/historicalReplayReport.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that calls:

```ts
const report = await buildHistoricalReplayReport({
  calledGamesCsvPath: csv,
  seasons: [2025],
  requiredSeasonCount: 1,
});
```

Assert:
- `report.seasons` equals `[2025]`
- `report.summary.totalPicks` is greater than `0`
- `report.coverage[0].featureSnapshots` is `1`
- `report.status` is `"verified"`
- `report.canClaimHighSuccessRate` is a boolean derived from actual ROI/win rate, not hard-coded.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/historicalReplayReport.test.ts`

Expected: FAIL because `buildHistoricalReplayReport` is not implemented.

- [ ] **Step 3: Write minimal implementation**

Add:
- `buildHistoricalReplayReport(request)` that loads CSV rows, calls `buildHistoricalSeasonReplay` for each season, and calls `runHistoricalBacktest`.
- `writeHistoricalReplayReport(request)` that writes JSON to `data/historical/exports/replay-report.json`.
- CLI script `src/server/scripts/runHistoricalReplay.ts`.
- `package.json` script: `"backtest:replay": "tsx src/server/scripts/runHistoricalReplay.ts"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/tests/historicalReplayReport.test.ts`

Expected: PASS.

### Task 3: API Reads Actual Replay Report

**Files:**
- Modify: `src/server/api.ts`
- Test: `src/tests/api.test.ts`

- [ ] **Step 1: Write the failing test**

Add an API test that creates a temporary replay report JSON with:

```json
{
  "seasons": [2025],
  "requiredSeasonCount": 1,
  "completedSeasonCount": 1,
  "status": "verified",
  "summary": { "totalPicks": 3 },
  "coverage": [],
  "blockers": [],
  "canClaimHighSuccessRate": false
}
```

Create the app with `historicalReplayReportPath` pointing at that temp file and assert `/api/backtest/historical` returns `status: "verified"` and `summary.totalPicks: 3`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/api.test.ts`

Expected: FAIL because the app dependency and endpoint do not read replay report JSON yet.

- [ ] **Step 3: Write minimal implementation**

Add optional `historicalReplayReportPath` and fallback path dependencies. In `/api/backtest/historical`, if the report file exists, return it. Otherwise return `buildHistoricalBacktestReadiness`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/tests/api.test.ts`

Expected: PASS.

### Task 4: Run Real Replay and Refresh Snapshot

**Files:**
- Generated: `data/historical/exports/replay-report.json`
- Modify: `src/server/import-report-snapshot.json` only if import report changed.

- [ ] **Step 1: Run replay on cached export**

Run: `npm run backtest:replay`

Expected: writes `data/historical/exports/replay-report.json` and prints total picks, status, ROI, win rate.

- [ ] **Step 2: Verify full project**

Run:
- `npm test`
- `npm run check`
- `npm run build`

Expected: all pass.

