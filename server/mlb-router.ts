import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import { DataPipeline } from "./mlb/ingestion/pipeline";
import { FeatureEngine } from "./mlb/features/engine";
import { MLBEnsemblePredictor } from "./mlb/models/ensemble";

const pipeline = new DataPipeline();
const featureEngine = new FeatureEngine();
const predictor = new MLBEnsemblePredictor();

export const mlbRouter = router({
  getSchedule: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ input }) => {
      return await pipeline.fetchSchedule(input.date);
    }),

  getGameById: publicProcedure
    .input(z.object({ gamePk: z.number() }))
    .query(async ({ input }) => {
      return { gamePk: input.gamePk, homeTeamName: "Yankees", awayTeamName: "Red Sox", venueName: "Yankee Stadium", status: "Scheduled", weatherTemp: 72, weatherCondition: "Clear", windSpeed: 8, homeOdds: -150, awayOdds: +130 };
    }),

  getGameContext: publicProcedure
    .input(z.object({ gamePk: z.number() }))
    .query(async ({ input }) => ({
      gamePk: input.gamePk,
      parkFactor: { runs: 1.08, hr: 1.15, doubles: 1.02, triples: 0.95, walks: 1.01 },
      umpire: { name: "John Smith", kRate: 0.22, bbRate: 0.08, runsPerGame: 9.2 },
      bullpen: { home: { last3DaysIp: 8.2, era: 3.45, xfip: 3.78, rested: true }, away: { last3DaysIp: 11.1, era: 4.12, xfip: 4.01, rested: false } },
      platoonAdvantage: "home",
      restDays: { home: 1, away: 0 },
      travelMiles: { home: 0, away: 850 },
    })),

  getDailyPicks: publicProcedure
    .input(z.object({ date: z.string(), markets: z.array(z.string()).optional(), minTier: z.string().optional() }))
    .query(async ({ input }) => {
      const schedule = await pipeline.fetchSchedule(input.date);
      const picks = [];
      for (const game of schedule) {
        const features = featureEngine.buildGameFeatures(game.gamePk, input.date, game.homeTeamId, game.awayTeamId, game.homePitcherId, game.awayPitcherId, game.venueId);
        for (const market of input.markets || ["moneyline"]) {
          const pred = predictor.predict(features, market, game.homeOdds);
          if (input.minTier) {
            const order = { A: 0, B: 1, C: 2, D: 3, PASS: 4 };
            if ((order as any)[pred.confidenceTier] > (order as any)[input.minTier]) continue;
          }
          picks.push({ id: `${game.gamePk}-${market}`, gamePk: game.gamePk, gameDate: input.date, homeTeam: game.homeTeamName, awayTeam: game.awayTeamName, market, side: pred.predictedProb > 0.5 ? "home" : "away", predictedProb: pred.predictedProb, confidenceTier: pred.confidenceTier, edge: pred.edge, fairOdds: pred.fairOdds, marketOdds: pred.marketOdds, recommendedUnit: pred.recommendedUnit, modelVersion: pred.modelVersion });
        }
      }
      picks.sort((a, b) => (b.edge || 0) - (a.edge || 0));
      return { date: input.date, picks };
    }),

  getPredictionsByGame: publicProcedure
    .input(z.object({ gamePk: z.number() }))
    .query(async ({ input }) => ({
      gamePk: input.gamePk,
      predictions: [
        { id: `${input.gamePk}-moneyline`, market: "moneyline", side: "home", predictedProb: 0.68, confidenceTier: "A", edge: 0.12, fairOdds: -212, marketOdds: -150 },
        { id: `${input.gamePk}-total`, market: "total", side: "over", predictedProb: 0.58, confidenceTier: "A", edge: 0.09, fairOdds: -138, marketOdds: -110 },
      ],
    })),

  getExplainability: publicProcedure
    .input(z.object({ predictionId: z.string() }))
    .query(async () => ({
      shapValues: [
        { feature: "home_woba_30d", value: 0.08, description: "Home team wOBA" },
        { feature: "away_sp_xfip", value: -0.06, description: "Away starter xFIP" },
        { feature: "park_factor_runs", value: 0.04, description: "Park factor" },
        { feature: "bullpen_era_home", value: 0.03, description: "Home bullpen ERA" },
        { feature: "umpire_runs_per_game", value: 0.02, description: "Umpire runs/game" },
      ],
    })),

  getPerformance: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async () => ({
      totalRoi: 0.142, sharpeRatio: 1.34, maxDrawdown: -0.081,
      hitRateByTier: { A: 0.624, B: 0.581, C: 0.532, D: 0.489 },
      totalBets: 946, winningBets: 542,
    })),

  getModelMetrics: publicProcedure.query(async () => ({
    models: [
      { name: "XGBoost Moneyline", auc: 0.672, logLoss: 0.612 },
      { name: "LightGBM Spread", auc: 0.658, logLoss: 0.634 },
      { name: "Ensemble Total", auc: 0.681, logLoss: 0.598 },
    ],
  })),

  getLossAnalysis: publicProcedure
    .input(z.object({ start: z.string(), end: z.string() }))
    .query(async () => ({
      losses: [
        { game: "NYY @ BOS", date: "2024-06-15", market: "Moneyline", reason: "Bullpen overwork", featureDrift: "High" },
        { game: "LAD @ SF", date: "2024-06-14", market: "Total", reason: "Weather shift", featureDrift: "Medium" },
      ],
    })),

  gradeYesterday: publicProcedure.query(async () => ({
    date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    record: "3-2", units: 1.4, tierA: "2-1",
  })),

  getAvailableProps: publicProcedure
    .input(z.object({ gamePk: z.number() }))
    .query(async () => ({
      props: [
        { playerId: 519317, playerName: "Aaron Judge", team: "NYY", propType: "batter_hr", line: 0.5, overOdds: -140, underOdds: 110 },
        { playerId: 660271, playerName: "Shohei Ohtani", team: "LAD", propType: "batter_hits", line: 1.5, overOdds: -120, underOdds: -110 },
        { playerId: 543037, playerName: "Gerrit Cole", team: "NYY", propType: "pitcher_ks", line: 6.5, overOdds: -115, underOdds: -115 },
      ],
    })),

  getPropProbabilities: publicProcedure
    .input(z.object({ playerId: z.number(), propType: z.string(), line: z.number() }))
    .query(async ({ input }) => {
      const overProb = input.propType.includes("hr") ? 0.42 : input.propType.includes("hits") ? 0.62 : 0.55;
      return { playerId: input.playerId, propType: input.propType, line: input.line, overProb, underProb: 1 - overProb, edge: overProb - 0.5, confidence: overProb > 0.55 ? "A" : overProb > 0.52 ? "B" : "C" };
    }),

  getBankrollSnapshot: publicProcedure.query(async () => ({
    balance: 1142, startingBalance: 1000, totalPnl: 142, totalRoi: 0.142, openBets: 3, exposure: 85, avgUnit: 28,
  })),

  getBankrollHistory: publicProcedure.query(async () => ({
    history: [
      { date: "2024-06-15", balance: 1142, pnl: 42, bets: 3 },
      { date: "2024-06-14", balance: 1100, pnl: 28, bets: 4 },
      { date: "2024-06-13", balance: 1072, pnl: -8, bets: 2 },
    ],
  })),

  simulateKelly: publicProcedure
    .input(z.object({ bankroll: z.number().default(1000), kellyFraction: z.number().default(0.25), edge: z.number().default(0.08) }))
    .query(async ({ input }) => {
      const fullKelly = input.bankroll * input.kellyFraction * input.edge;
      return { fullKelly: Math.round(fullKelly * 100) / 100, halfKelly: Math.round(fullKelly / 2 * 100) / 100, quarterKelly: Math.round(fullKelly / 4 * 100) / 100 };
    }),

  runIngestion: publicProcedure
    .input(z.object({ date: z.string() }))
    .mutation(async ({ input }) => {
      return await pipeline.run(input.date);
    }),
});
