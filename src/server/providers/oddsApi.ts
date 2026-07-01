import { type FetchLike, type ProviderResult } from "./mlbStats";

export type OddsOutcome = {
  name: string;
  price: number;
  point?: number;
};

export type OddsMarket = {
  key: string;
  outcomes: OddsOutcome[];
};

export type OddsBookmaker = {
  key: string;
  title: string;
  lastUpdate: string;
  markets: OddsMarket[];
};

export type OddsEvent = {
  id: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bookmakers: OddsBookmaker[];
};

export type OddsRequest = {
  apiKey: string;
  fetchImpl?: FetchLike;
  regions?: string;
  markets?: string[];
  oddsFormat?: "american" | "decimal";
};

export type HistoricalOddsRequest = OddsRequest & {
  isoTimestamp: string;
};

const ODDS_BASE_URL = "https://api.the-odds-api.com/v4";
const MLB_SPORT_KEY = "baseball_mlb";
const DEFAULT_MARKETS = ["h2h", "spreads", "totals"];

export async function fetchMlbOdds(request: OddsRequest): Promise<ProviderResult<OddsEvent[]>> {
  const keyCheck = requireApiKey(request.apiKey);
  if (!keyCheck.ok) {
    return keyCheck;
  }

  const fetchImpl = request.fetchImpl ?? fetch;
  const url = buildOddsUrl(`${ODDS_BASE_URL}/sports/${MLB_SPORT_KEY}/odds`, request);

  return fetchOddsEvents(url, fetchImpl, "The Odds API");
}

export async function fetchHistoricalMlbOdds(
  request: HistoricalOddsRequest
): Promise<ProviderResult<OddsEvent[]>> {
  const keyCheck = requireApiKey(request.apiKey);
  if (!keyCheck.ok) {
    return keyCheck;
  }

  const fetchImpl = request.fetchImpl ?? fetch;
  const url = buildOddsUrl(`${ODDS_BASE_URL}/historical/sports/${MLB_SPORT_KEY}/odds`, request);
  url.searchParams.set("date", request.isoTimestamp);

  return fetchOddsEvents(url, fetchImpl, "The Odds API historical odds");
}

function buildOddsUrl(baseUrl: string, request: OddsRequest): URL {
  const url = new URL(baseUrl);
  url.searchParams.set("apiKey", request.apiKey.trim());
  url.searchParams.set("regions", request.regions ?? "us");
  url.searchParams.set("markets", (request.markets ?? DEFAULT_MARKETS).join(","));
  url.searchParams.set("oddsFormat", request.oddsFormat ?? "american");
  return url;
}

async function fetchOddsEvents(
  url: URL,
  fetchImpl: FetchLike,
  providerName: string
): Promise<ProviderResult<OddsEvent[]>> {
  try {
    const response = await fetchImpl(url.toString());
    if (!response.ok) {
      return {
        ok: false,
        error: `${providerName} request failed with status ${response.status}`,
        status: response.status,
      };
    }

    const body = await response.json();
    const events = Array.isArray(body) ? body : ((body as { data?: unknown[] }).data ?? []);
    return { ok: true, data: events.map(normalizeOddsEvent) };
  } catch (error) {
    return {
      ok: false,
      error: `${providerName} request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function normalizeOddsEvent(event: any): OddsEvent {
  return {
    id: event.id ?? "",
    commenceTime: event.commence_time ?? "",
    homeTeam: event.home_team ?? "",
    awayTeam: event.away_team ?? "",
    bookmakers: (event.bookmakers ?? []).map((bookmaker: any) => ({
      key: bookmaker.key ?? "",
      title: bookmaker.title ?? "",
      lastUpdate: bookmaker.last_update ?? "",
      markets: (bookmaker.markets ?? []).map((market: any) => ({
        key: market.key ?? "",
        outcomes: (market.outcomes ?? []).map((outcome: any) => ({
          name: outcome.name ?? "",
          price: outcome.price,
          point: outcome.point,
        })),
      })),
    })),
  };
}

function requireApiKey(apiKey: string): ProviderResult<never> | { ok: true } {
  if (!apiKey.trim()) {
    return {
      ok: false,
      error: "ODDS_API_KEY is required to call The Odds API",
    };
  }

  return { ok: true };
}
