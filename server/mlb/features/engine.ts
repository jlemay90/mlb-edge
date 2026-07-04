export class FeatureEngine {
  buildGameFeatures(gamePk: number, gameDate: string, homeTeamId: number, awayTeamId: number, homePitcherId?: number, awayPitcherId?: number, venueId?: number): Record<string, number> {
    const f: Record<string, number> = {};
    const hs = homeTeamId * 1000, as = awayTeamId * 1000;
    f["home_woba_30d"] = this.rnd(hs, 0.33, 0.015); f["home_wrc_30d"] = Math.round(this.rnd(hs+1, 105, 12));
    f["home_iso_30d"] = this.rnd(hs+2, 0.170, 0.020); f["home_k_rate_30d"] = this.rnd(hs+3, 0.22, 0.02);
    f["home_bb_rate_30d"] = this.rnd(hs+4, 0.085, 0.01); f["home_hard_hit_30d"] = this.rnd(hs+5, 0.40, 0.03);
    f["home_barrel_rate_30d"] = this.rnd(hs+6, 0.075, 0.01); f["home_xwoba_30d"] = this.rnd(hs+7, 0.335, 0.015);
    f["away_woba_30d"] = this.rnd(as, 0.32, 0.015); f["away_wrc_30d"] = Math.round(this.rnd(as+1, 102, 12));
    f["away_iso_30d"] = this.rnd(as+2, 0.165, 0.020); f["away_k_rate_30d"] = this.rnd(as+3, 0.23, 0.02);
    f["away_bb_rate_30d"] = this.rnd(as+4, 0.08, 0.01); f["away_hard_hit_30d"] = this.rnd(as+5, 0.38, 0.03);
    f["away_barrel_rate_30d"] = this.rnd(as+6, 0.07, 0.01); f["away_xwoba_30d"] = this.rnd(as+7, 0.325, 0.015);
    const hp = (homePitcherId || 0) * 100, ap = (awayPitcherId || 0) * 100;
    f["home_sp_xfip"] = this.rnd(hp, 3.8, 0.4); f["home_sp_era"] = this.rnd(hp+1, 3.6, 0.5);
    f["home_sp_k9"] = this.rnd(hp+2, 9.0, 1.0); f["home_sp_bb9"] = this.rnd(hp+3, 2.8, 0.5);
    f["home_sp_whip"] = this.rnd(hp+4, 1.18, 0.08); f["home_sp_gb_pct"] = this.rnd(hp+5, 0.44, 0.05);
    f["away_sp_xfip"] = this.rnd(ap, 4.0, 0.4); f["away_sp_era"] = this.rnd(ap+1, 3.9, 0.5);
    f["away_sp_k9"] = this.rnd(ap+2, 8.5, 1.0); f["away_sp_bb9"] = this.rnd(ap+3, 3.1, 0.5);
    f["away_sp_whip"] = this.rnd(ap+4, 1.25, 0.08); f["away_sp_gb_pct"] = this.rnd(ap+5, 0.42, 0.05);
    f["home_bullpen_era_7d"] = this.rnd(hs+100, 3.8, 0.6); f["away_bullpen_era_7d"] = this.rnd(as+100, 4.1, 0.6);
    f["park_factor_runs"] = 1.08; f["park_factor_hr"] = 1.15; f["umpire_k_rate"] = 0.22;
    f["umpire_bb_rate"] = 0.08; f["umpire_runs_per_game"] = 9.2; f["weather_temp"] = 72;
    f["wind_speed"] = 8; f["is_night_game"] = 0; f["home_rest_days"] = 1;
    f["away_rest_days"] = 0; f["away_travel_miles"] = 850; f["platoon_advantage_home"] = 1;
    f["opening_line"] = -140; f["line_movement_pct"] = -0.07; f["public_betting_pct"] = 0.65;
    f["home_h2h_last10"] = this.rnd(hs+as, 0.55, 0.15); f["home_streak_last5"] = this.rnd(hs+200, 0.6, 0.2);
    return f;
  }

  private rnd(seed: number, mean: number, std: number): number {
    const x = Math.sin(seed) * 10000;
    const r = x - Math.floor(x);
    const z = Math.sqrt(-2 * Math.log(1-r)) * Math.cos(2 * Math.PI * r);
    return Math.round((mean + z * std) * 1000) / 1000;
  }
}
