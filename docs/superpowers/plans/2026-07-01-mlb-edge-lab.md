# MLB Edge Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional personal MLB prediction lab with explainable picks, parlay grading, historical backtesting, calibration, model-version tracking, and an accessible web app.

**Architecture:** Create a clean TypeScript monorepo-style Vite app in the current root workspace. Keep model logic in small pure modules under `src/domain`, API/data adapters under `src/server`, and React screens under `src/client`. Use SQLite for local persistence and keep every generated pick tied to a feature snapshot and model version.

**Tech Stack:** TypeScript, React, Vite, Vitest, Express, SQLite, Recharts, lucide-react, MLB Stats API, The Odds API, National Weather Service API, Open-Meteo fallback, OpenAI API for optional narratives.

---

## File Structure

- Create `package.json`: scripts, dependencies, and project metadata.
- Create `tsconfig.json`: shared strict TypeScript config.
- Create `vite.config.ts`: React/Vite config.
- Create `vitest.config.ts`: test config for domain and server modules.
- Create `index.html`: Vite app shell.
- Create `src/main.tsx`: React entrypoint.
- Create `src/client/App.tsx`: route/state composition for the personal app.
- Create `src/client/styles.css`: app tokens and responsive layout CSS.
- Create `src/client/components/*`: shared UI primitives.
- Create `src/client/pages/TodayPage.tsx`: daily picks dashboard.
- Create `src/client/pages/PickDetailPage.tsx`: why-this-pick view.
- Create `src/client/pages/ParlaysPage.tsx`: parlay cards and leg details.
- Create `src/client/pages/GradingPage.tsx`: results and debriefs.
- Create `src/client/pages/BacktestPage.tsx`: date-range replay controls and metrics.
- Create `src/client/pages/ModelLabPage.tsx`: calibration, thresholds, versions.
- Create `src/client/pages/DataHealthPage.tsx`: API/source health.
- Create `src/domain/odds.ts`: American odds, implied probability, no-vig, EV, CLV.
- Create `src/domain/modelConfig.ts`: versioned model configuration.
- Create `src/domain/projection.ts`: run projection and market probability functions.
- Create `src/domain/picks.ts`: pick generation, thresholding, confidence, rationale facts.
- Create `src/domain/parlays.ts`: parlay assembly and correlation warnings.
- Create `src/domain/grading.ts`: pick/parlay settlement.
- Create `src/domain/backtest.ts`: replay summaries and ROI metrics.
- Create `src/domain/calibration.ts`: probability buckets and threshold candidates.
- Create `src/domain/explanations.ts`: deterministic explanation strings with optional OpenAI handoff.
- Create `src/domain/sampleData.ts`: deterministic development slate and historical fixtures.
- Create `src/server/api.ts`: Express JSON API for UI calls.
- Create `src/server/providers/mlbStats.ts`: MLB schedule/final score provider.
- Create `src/server/providers/oddsApi.ts`: The Odds API provider.
- Create `src/server/providers/weather.ts`: NWS first-pitch forecast and Open-Meteo fallback.
- Create `src/server/db/schema.ts`: SQLite schema statements.
- Create `src/server/db/client.ts`: SQLite connection and migrations.
- Create `src/server/repositories/picksRepository.ts`: persisted pick snapshots and results.
- Create `src/server/repositories/modelRepository.ts`: model version and calibration persistence.
- Create `src/tests/*.test.ts`: Vitest tests for each domain module.

## Task 1: Project Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/styles.css`

- [ ] **Step 1: Create package metadata and scripts**

Create `package.json`:

```json
{
  "name": "mlb-edge-lab",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "server": "tsx src/server/api.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "tsc --noEmit",
    "build": "vite build"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.4",
    "better-sqlite3": "^11.9.1",
    "date-fns": "^4.1.0",
    "express": "^4.21.2",
    "lucide-react": "^0.468.0",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "recharts": "^2.15.2",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/express": "^4.17.21",
    "@types/node": "^24.7.0",
    "@types/react": "^19.2.1",
    "@types/react-dom": "^19.2.1",
    "tsx": "^4.19.1",
    "typescript": "^5.9.3",
    "vite": "^7.1.7",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Add strict TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Add Vite and Vitest configs**

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: false,
  },
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Add minimal React shell**

Create `index.html`, `src/main.tsx`, `src/client/App.tsx`, and `src/client/styles.css` with a visible app shell that says `MLB Edge Lab` and includes navigation labels for Today, Parlays, Grading, Backtest, Model Lab, and Data Health.

- [ ] **Step 5: Install dependencies and verify foundation**

Run: `npm install`

Run: `npm run check`

Expected: TypeScript completes with no errors.

- [ ] **Step 6: Commit foundation**

Run:

```powershell
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts index.html src
git commit -m "chore: scaffold mlb edge lab"
```

## Task 2: Odds Math

**Files:**
- Create: `src/domain/odds.ts`
- Create: `src/tests/odds.test.ts`

- [ ] **Step 1: Write failing odds tests**

Create `src/tests/odds.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  americanToDecimal,
  americanToImplied,
  calculateClv,
  calculateExpectedValue,
  impliedToAmerican,
  removeVigTwoWay,
} from "../domain/odds";

describe("odds math", () => {
  it("converts American odds to implied probability", () => {
    expect(americanToImplied(-110)).toBeCloseTo(0.5238, 4);
    expect(americanToImplied(150)).toBeCloseTo(0.4, 4);
  });

  it("converts implied probability back to American odds", () => {
    expect(impliedToAmerican(0.6)).toBe(-150);
    expect(impliedToAmerican(0.4)).toBe(150);
  });

  it("removes vig from a two-way market", () => {
    const noVig = removeVigTwoWay(-110, -110);
    expect(noVig.a).toBeCloseTo(0.5, 5);
    expect(noVig.b).toBeCloseTo(0.5, 5);
  });

  it("calculates expected value per unit stake", () => {
    expect(calculateExpectedValue(0.55, -110)).toBeCloseTo(0.05, 2);
  });

  it("calculates closing-line value as probability improvement", () => {
    expect(calculateClv(-110, -130)).toBeGreaterThan(0);
  });

  it("converts American odds to decimal odds", () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.909, 3);
    expect(americanToDecimal(150)).toBeCloseTo(2.5, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/odds.test.ts`

Expected: FAIL because `src/domain/odds.ts` does not exist.

- [ ] **Step 3: Implement odds functions**

Create `src/domain/odds.ts`:

```ts
export function americanToDecimal(odds: number): number {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function americanToImplied(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
}

export function impliedToAmerican(probability: number): number {
  if (probability <= 0 || probability >= 1) {
    throw new Error("Probability must be between 0 and 1");
  }
  return probability >= 0.5
    ? Math.round(-(probability / (1 - probability)) * 100)
    : Math.round(((1 - probability) / probability) * 100);
}

export function removeVigTwoWay(aOdds: number, bOdds: number): { a: number; b: number; overround: number } {
  const aImplied = americanToImplied(aOdds);
  const bImplied = americanToImplied(bOdds);
  const overround = aImplied + bImplied;
  return { a: aImplied / overround, b: bImplied / overround, overround };
}

export function calculateExpectedValue(modelProbability: number, odds: number): number {
  const decimal = americanToDecimal(odds);
  return modelProbability * (decimal - 1) - (1 - modelProbability);
}

export function calculateClv(pickOdds: number, closingOdds: number): number {
  return americanToImplied(closingOdds) - americanToImplied(pickOdds);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/tests/odds.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit odds math**

Run:

```powershell
git add src/domain/odds.ts src/tests/odds.test.ts
git commit -m "feat: add odds math"
```

## Task 3: Versioned Model Config

**Files:**
- Create: `src/domain/modelConfig.ts`
- Create: `src/tests/modelConfig.test.ts`

- [ ] **Step 1: Write failing model config tests**

Create `src/tests/modelConfig.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_CONFIG, getMarketThreshold, versionModelConfig } from "../domain/modelConfig";

describe("model config", () => {
  it("has explicit thresholds for each primary market", () => {
    expect(getMarketThreshold(DEFAULT_MODEL_CONFIG, "moneyline")).toBeGreaterThan(0);
    expect(getMarketThreshold(DEFAULT_MODEL_CONFIG, "runline")).toBeGreaterThan(0);
    expect(getMarketThreshold(DEFAULT_MODEL_CONFIG, "total")).toBeGreaterThan(0);
  });

  it("creates a new immutable config version with a changelog reason", () => {
    const next = versionModelConfig(DEFAULT_MODEL_CONFIG, {
      reason: "Raise total threshold after poor calibration",
      thresholds: { total: 0.045 },
    });

    expect(next.version).not.toBe(DEFAULT_MODEL_CONFIG.version);
    expect(next.thresholds.total).toBe(0.045);
    expect(DEFAULT_MODEL_CONFIG.thresholds.total).not.toBe(0.045);
    expect(next.changelog[0]).toContain("Raise total threshold");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/modelConfig.test.ts`

Expected: FAIL because `src/domain/modelConfig.ts` does not exist.

- [ ] **Step 3: Implement model config**

Create `src/domain/modelConfig.ts` with `Market`, `ModelConfig`, `DEFAULT_MODEL_CONFIG`, `getMarketThreshold`, and `versionModelConfig`. Include market thresholds for `moneyline`, `runline`, `total`, and `prop`, plus projection weights for offense, starter, bullpen, park, weather, lineup, and recent form.

- [ ] **Step 4: Run model config tests**

Run: `npm test -- src/tests/modelConfig.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit model config**

Run:

```powershell
git add src/domain/modelConfig.ts src/tests/modelConfig.test.ts
git commit -m "feat: add versioned model config"
```

## Task 4: Projection And Pick Engine

**Files:**
- Create: `src/domain/projection.ts`
- Create: `src/domain/picks.ts`
- Create: `src/tests/projection.test.ts`
- Create: `src/tests/picks.test.ts`

- [ ] **Step 1: Write failing projection tests**

Create tests proving that better offense increases projected runs, better opposing starter lowers projected runs, hitter parks increase totals, and short-rest bullpens increase late-game run projection.

- [ ] **Step 2: Run projection tests to verify failure**

Run: `npm test -- src/tests/projection.test.ts`

Expected: FAIL because projection module does not exist.

- [ ] **Step 3: Implement projection module**

Create pure functions:

```ts
export function projectTeamRuns(features: GameFeatures, side: "home" | "away", config = DEFAULT_MODEL_CONFIG): number;
export function calculateWinProbabilities(homeRuns: number, awayRuns: number): { home: number; away: number };
export function calculateTotalProbability(projectedTotal: number, bookTotal: number): { over: number; under: number };
export function calculateRunLineProbability(runDiff: number, spread: number): { home: number; away: number };
```

- [ ] **Step 4: Write failing pick tests**

Create tests proving the engine only recommends picks with positive edge above threshold, stores model version, stores feature snapshots, and returns no pick when odds are missing.

- [ ] **Step 5: Implement pick generation**

Create:

```ts
export function analyzeGame(features: GameFeatures, config = DEFAULT_MODEL_CONFIG): GameAnalysis;
export function selectQualifiedPicks(analyses: GameAnalysis[], config = DEFAULT_MODEL_CONFIG): Pick[];
export function getConfidenceTier(edge: number): "A" | "B" | "C" | "D";
```

- [ ] **Step 6: Verify projection and pick tests pass**

Run: `npm test -- src/tests/projection.test.ts src/tests/picks.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit projection and picks**

Run:

```powershell
git add src/domain/projection.ts src/domain/picks.ts src/tests/projection.test.ts src/tests/picks.test.ts
git commit -m "feat: add projection and pick engine"
```

## Task 5: Pick Explanations

**Files:**
- Create: `src/domain/explanations.ts`
- Create: `src/tests/explanations.test.ts`

- [ ] **Step 1: Write failing explanation tests**

Tests must assert that explanations include the bet, model probability, no-vig market probability, edge, projected score, top signals, and missing-data warnings.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/tests/explanations.test.ts`

Expected: FAIL because explanation module does not exist.

- [ ] **Step 3: Implement deterministic explanation builder**

Create `buildPickExplanation(pick: Pick): PickExplanation` that returns bullet facts and a narrative string. The narrative must use only stored feature snapshot fields and must label estimates as estimates.

- [ ] **Step 4: Verify explanation tests pass**

Run: `npm test -- src/tests/explanations.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit explanations**

Run:

```powershell
git add src/domain/explanations.ts src/tests/explanations.test.ts
git commit -m "feat: explain pick reasoning"
```

## Task 6: Parlay Assembly

**Files:**
- Create: `src/domain/parlays.ts`
- Create: `src/tests/parlays.test.ts`

- [ ] **Step 1: Write failing parlay tests**

Tests must assert that parlay cards use qualified picks only, include leg reasoning, compute combined odds, warn about same-game correlation, and refuse to create cards when there are too few qualified legs.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/tests/parlays.test.ts`

Expected: FAIL because parlay module does not exist.

- [ ] **Step 3: Implement parlay module**

Create `buildDailyParlays(picks: Pick[]): ParlayCard[]` and `combineParlayOdds(odds: number[]): number`.

- [ ] **Step 4: Verify parlay tests pass**

Run: `npm test -- src/tests/parlays.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit parlay assembly**

Run:

```powershell
git add src/domain/parlays.ts src/tests/parlays.test.ts
git commit -m "feat: build explainable parlays"
```

## Task 7: Grading

**Files:**
- Create: `src/domain/grading.ts`
- Create: `src/tests/grading.test.ts`

- [ ] **Step 1: Write failing grading tests**

Tests must cover moneyline wins/losses, run line cover/fail, totals over/under/push, postponed voids, parlay card win/loss/push, and debrief fact generation.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/tests/grading.test.ts`

Expected: FAIL because grading module does not exist.

- [ ] **Step 3: Implement grading**

Create:

```ts
export function gradePick(pick: Pick, final: FinalGameResult): GradedPick;
export function gradeParlay(card: ParlayCard, results: FinalGameResult[]): GradedParlay;
export function buildPostgameDebriefFacts(graded: GradedParlay): DebriefFacts;
```

- [ ] **Step 4: Verify grading tests pass**

Run: `npm test -- src/tests/grading.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit grading**

Run:

```powershell
git add src/domain/grading.ts src/tests/grading.test.ts
git commit -m "feat: grade picks and parlays"
```

## Task 8: Backtesting And Calibration

**Files:**
- Create: `src/domain/backtest.ts`
- Create: `src/domain/calibration.ts`
- Create: `src/tests/backtest.test.ts`
- Create: `src/tests/calibration.test.ts`

- [ ] **Step 1: Write failing backtest tests**

Tests must verify date-range replay summaries, ROI, unit results, average odds, average edge, drawdown, CLV metrics when closing odds exist, and a clear missing-CLV flag when closing odds are absent.

- [ ] **Step 2: Write failing calibration tests**

Tests must verify probability bucket aggregation, actual hit rate by bucket, overconfidence detection, minimum sample-size gating, and threshold candidate evaluation.

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- src/tests/backtest.test.ts src/tests/calibration.test.ts`

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement backtest and calibration modules**

Create `runBacktest`, `summarizeBacktest`, `buildCalibrationBuckets`, and `recommendThresholdChanges`. Candidate changes must require at least 100 picks for warnings and 200 picks per market for adoption eligibility.

- [ ] **Step 5: Verify backtest and calibration tests pass**

Run: `npm test -- src/tests/backtest.test.ts src/tests/calibration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit backtest and calibration**

Run:

```powershell
git add src/domain/backtest.ts src/domain/calibration.ts src/tests/backtest.test.ts src/tests/calibration.test.ts
git commit -m "feat: add backtest and calibration engine"
```

## Task 9: Data Providers

**Files:**
- Create: `src/server/providers/mlbStats.ts`
- Create: `src/server/providers/oddsApi.ts`
- Create: `src/server/providers/weather.ts`
- Create: `src/tests/providers.test.ts`

- [ ] **Step 1: Write failing provider tests using injected fetch**

Tests must use fake fetch functions and assert request URLs, request headers, response normalization, and safe failures.

- [ ] **Step 2: Implement MLB provider**

Create schedule and final-score functions around `https://statsapi.mlb.com/api/v1`.

- [ ] **Step 3: Implement Odds API provider**

Create odds and historical-odds functions around `https://api.the-odds-api.com/v4`, requiring `ODDS_API_KEY` only at call time.

- [ ] **Step 4: Implement weather provider**

Use NWS first with a `NWS_USER_AGENT` header. Use Open-Meteo for non-U.S. or NWS-unavailable locations. No weather API key is required in the first version.

- [ ] **Step 5: Verify provider tests pass**

Run: `npm test -- src/tests/providers.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit providers**

Run:

```powershell
git add src/server/providers src/tests/providers.test.ts
git commit -m "feat: add mlb odds and weather providers"
```

## Task 10: Persistence And API

**Files:**
- Create: `src/server/db/schema.ts`
- Create: `src/server/db/client.ts`
- Create: `src/server/repositories/picksRepository.ts`
- Create: `src/server/repositories/modelRepository.ts`
- Create: `src/server/api.ts`
- Create: `src/tests/api.test.ts`

- [ ] **Step 1: Write failing repository/API tests**

Tests must verify migrations run, model versions persist, generated picks persist with feature snapshots, graded picks update result fields, and API key health never returns secret values.

- [ ] **Step 2: Implement SQLite schema and migrations**

Tables: `model_versions`, `picks`, `parlay_cards`, `parlay_legs`, `game_results`, `odds_snapshots`, `calibration_snapshots`, `api_health`.

- [ ] **Step 3: Implement repositories**

Create insert/read/update functions for picks, parlays, model versions, calibration summaries, and odds snapshots.

- [ ] **Step 4: Implement Express API**

Routes:

- `GET /api/health`
- `GET /api/today?date=YYYY-MM-DD`
- `GET /api/picks/:id`
- `GET /api/parlays?date=YYYY-MM-DD`
- `POST /api/grade`
- `POST /api/backtest`
- `GET /api/model`
- `POST /api/model/adopt-thresholds`
- `GET /api/data-health`

- [ ] **Step 5: Verify API tests pass**

Run: `npm test -- src/tests/api.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit persistence/API**

Run:

```powershell
git add src/server/db src/server/repositories src/server/api.ts src/tests/api.test.ts
git commit -m "feat: persist model lab data"
```

## Task 11: Frontend Concept And App UI

**Files:**
- Create: `docs/design/mlb-edge-lab-dashboard-concept.md`
- Create or modify: `src/client/App.tsx`
- Create or modify: `src/client/styles.css`
- Create: `src/client/pages/TodayPage.tsx`
- Create: `src/client/pages/PickDetailPage.tsx`
- Create: `src/client/pages/ParlaysPage.tsx`
- Create: `src/client/pages/GradingPage.tsx`
- Create: `src/client/pages/BacktestPage.tsx`
- Create: `src/client/pages/ModelLabPage.tsx`
- Create: `src/client/pages/DataHealthPage.tsx`

- [ ] **Step 1: Generate and inspect a visual concept**

Use Image Gen to create a dense, professional personal analytics dashboard concept for MLB Edge Lab. The concept must show the Today dashboard with slate table, top pick detail, model/version summary, calibration mini-chart, and data health sidebar.

- [ ] **Step 2: Save the design inventory**

Create `docs/design/mlb-edge-lab-dashboard-concept.md` with colors, layout, typography, component inventory, route list, and interaction states.

- [ ] **Step 3: Implement React pages**

Build actual pages with local app state and API calls. Use dense dashboard layout, accessible controls, responsive tables, and clear empty/error states.

- [ ] **Step 4: Verify frontend with Browser/IAB**

Run: `npm run dev`

Open: `http://127.0.0.1:3000`

Verify Today, pick detail, parlays, grading, backtest, model lab, and data health views.

- [ ] **Step 5: Commit UI**

Run:

```powershell
git add docs/design src/client src/main.tsx index.html
git commit -m "feat: build personal model dashboard"
```

## Task 12: Full Verification And GitHub

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Add README**

Document the app purpose, API keys, NWS User-Agent, how to run, how to test, how to backtest, and the self-improvement guardrails.

- [ ] **Step 2: Run all checks**

Run:

```powershell
npm test
npm run check
npm run build
```

Expected: all pass.

- [ ] **Step 3: Run local app verification**

Run: `npm run dev`

Open browser and verify the app renders and core flows work. Capture screenshots for desktop and mobile.

- [ ] **Step 4: Create or connect GitHub repo**

If `jlemay90/mlb-edge-lab` already exists, set remote:

```powershell
git remote add origin https://github.com/jlemay90/mlb-edge-lab.git
git branch -M main
git push -u origin main
```

If the repo does not exist and `GITHUB_TOKEN` is present locally, create it with the GitHub REST API and then push.

- [ ] **Step 5: Final completion audit**

Audit the objective requirement by requirement:

- fully functional model
- high-win-rate claim supported by backtest evidence rather than marketing copy
- fully backtested with explicit historical-data limitations
- web app accessible in browser
- explainable picks
- parlay grading
- self-improvement guarded by calibration and sample-size rules
- no Stripe or sales features

