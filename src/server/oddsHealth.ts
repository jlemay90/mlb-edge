import { fetchHistoricalMlbOdds, fetchMlbOdds } from "./providers/oddsApi.js";
import { type ProviderRequestUsage } from "./providers/mlbStats.js";

export type LiveOddsHealth = {
  configured: boolean;
  ok: boolean;
  checkedAt: string;
  eventCount: number;
  status?: number;
  requestUsage?: ProviderRequestUsage;
  error?: string;
};

export type LiveOddsHealthCheck = (apiKey: string) => Promise<LiveOddsHealth>;

export type HistoricalOddsHealth = {
  configured: boolean;
  ok: boolean;
  checkedAt: string;
  snapshotDate: string;
  eventCount: number;
  status?: number;
  requestUsage?: ProviderRequestUsage;
  error?: string;
};

export type HistoricalOddsHealthCheck = (apiKey: string, snapshotDate: string) => Promise<HistoricalOddsHealth>;

export async function checkLiveOddsAccess(apiKey: string): Promise<LiveOddsHealth> {
  const checkedAt = new Date().toISOString();
  if (!apiKey.trim()) {
    return {
      configured: false,
      ok: false,
      checkedAt,
      eventCount: 0,
      error: "ODDS_API_KEY is not configured.",
    };
  }

  const result = await fetchMlbOdds({
    apiKey,
    markets: ["h2h"],
  });

  if (!result.ok) {
    return {
      configured: true,
      ok: false,
      checkedAt,
      eventCount: 0,
      status: result.status,
      requestUsage: result.requestUsage,
      error: result.error,
    };
  }

  return {
    configured: true,
    ok: true,
    checkedAt,
    eventCount: result.data.length,
    requestUsage: result.requestUsage,
  };
}

export async function checkHistoricalOddsAccess(
  apiKey: string,
  snapshotDate: string
): Promise<HistoricalOddsHealth> {
  const checkedAt = new Date().toISOString();
  if (!apiKey.trim()) {
    return {
      configured: false,
      ok: false,
      checkedAt,
      snapshotDate,
      eventCount: 0,
      error: "ODDS_API_KEY is not configured.",
    };
  }

  const result = await fetchHistoricalMlbOdds({
    apiKey,
    isoTimestamp: snapshotDate,
    markets: ["h2h"],
  });

  if (!result.ok) {
    return {
      configured: true,
      ok: false,
      checkedAt,
      snapshotDate,
      eventCount: 0,
      status: result.status,
      requestUsage: result.requestUsage,
      error: result.error,
    };
  }

  return {
    configured: true,
    ok: true,
    checkedAt,
    snapshotDate,
    eventCount: result.data.length,
    requestUsage: result.requestUsage,
  };
}
