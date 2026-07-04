export interface PredictionResult {
  predictedProb: number; marketProb: number; confidenceTier: string;
  edge: number; fairOdds: number; marketOdds?: number;
  modelVersion: string; baseModels: string[];
  featureImportance: Record<string, number>; recommendedUnit: number;
}

export class MLBEnsemblePredictor {
  predict(features: Record<string, number>, market: string, marketOdds?: number): PredictionResult {
    const logit = -3.5 + (features["home_woba_30d"] || 0) * 2.5 + (features["away_sp_xfip"] || 0) * -1.5 + (features["park_factor_runs"] || 0) * 0.8 + (features["home_rest_days"] || 0) * 0.3;
    const prob = Math.max(0.01, Math.min(0.99, 1 / (1 + Math.exp(-logit))));
    const mktProb = marketOdds ? (marketOdds > 0 ? 100/(marketOdds+100) : Math.abs(marketOdds)/(Math.abs(marketOdds)+100)) : 0.5;
    const edge = prob - mktProb;
    const fairOdds = prob >= 0.5 ? -Math.round((prob/(1-prob))*100) : Math.round(((1-prob)/prob)*100);
    const tier = edge >= 0.08 && prob >= 0.70 ? "A" : edge >= 0.04 && prob >= 0.60 ? "B" : edge >= 0.02 || prob >= 0.55 ? "C" : edge > 0 ? "D" : "PASS";
    return { predictedProb: Math.round(prob*10000)/10000, marketProb: Math.round(mktProb*10000)/10000, confidenceTier: tier, edge: Math.round(edge*10000)/10000, fairOdds, marketOdds, modelVersion: "v2.0-ensemble", baseModels: ["weighted-linear"], featureImportance: { "home_woba_30d": 0.08, "away_sp_xfip": -0.06, "park_factor_runs": 0.04 }, recommendedUnit: edge > 0 ? Math.round(1000*0.25*edge*100)/100 : 0 };
  }
}
