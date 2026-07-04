import { type FetchLike, type ProviderResult } from "./mlbStats.js";

export type WeatherSource = "nws" | "open-meteo" | "open-meteo-archive";

export type GameWeather = {
  source: WeatherSource;
  temperatureF?: number;
  windSpeedMph?: number;
  windDirection?: string;
  shortForecast?: string;
  observedAt?: string;
};

export type WeatherRequest = {
  latitude: number;
  longitude: number;
  firstPitchIso: string;
  userAgent: string;
  fetchImpl?: FetchLike;
};

export type HistoricalWeatherRequest = Omit<WeatherRequest, "userAgent">;

export async function fetchGameWeather(request: WeatherRequest): Promise<ProviderResult<GameWeather>> {
  const fetchImpl = request.fetchImpl ?? fetch;
  const nws = await fetchNwsWeather(request, fetchImpl);

  if (nws.ok) {
    return nws;
  }

  const fallback = await fetchOpenMeteoWeather(request, fetchImpl);
  if (fallback.ok) {
    return fallback;
  }

  return {
    ok: false,
    error: `Weather unavailable: ${nws.error}; ${fallback.error}`,
  };
}

export async function fetchHistoricalGameWeather(
  request: HistoricalWeatherRequest
): Promise<ProviderResult<GameWeather>> {
  const fetchImpl = request.fetchImpl ?? fetch;
  const gameDate = isoDateOnly(request.firstPitchIso);
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(request.latitude));
  url.searchParams.set("longitude", String(request.longitude));
  url.searchParams.set("start_date", gameDate);
  url.searchParams.set("end_date", gameDate);
  url.searchParams.set("hourly", "temperature_2m,wind_speed_10m,wind_direction_10m");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "UTC");

  const result = await fetchOpenMeteoWeatherFromUrl(url, request.firstPitchIso, fetchImpl);
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: {
      ...result.data,
      source: "open-meteo-archive",
    },
  };
}

async function fetchNwsWeather(
  request: WeatherRequest,
  fetchImpl: FetchLike
): Promise<ProviderResult<GameWeather>> {
  const headers = {
    "User-Agent": request.userAgent,
    Accept: "application/geo+json",
  };

  try {
    const pointsUrl = `https://api.weather.gov/points/${request.latitude},${request.longitude}`;
    const pointsResponse = await fetchImpl(pointsUrl, { headers });
    if (!pointsResponse.ok) {
      return {
        ok: false,
        error: `NWS points request failed with status ${pointsResponse.status}`,
        status: pointsResponse.status,
      };
    }

    const pointsBody = await pointsResponse.json();
    const forecastHourly = (pointsBody as { properties?: { forecastHourly?: string } }).properties?.forecastHourly;
    if (!forecastHourly) {
      return { ok: false, error: "NWS points response did not include hourly forecast URL" };
    }

    const forecastResponse = await fetchImpl(forecastHourly, { headers });
    if (!forecastResponse.ok) {
      return {
        ok: false,
        error: `NWS hourly forecast failed with status ${forecastResponse.status}`,
        status: forecastResponse.status,
      };
    }

    const forecastBody = await forecastResponse.json();
    const periods = ((forecastBody as { properties?: { periods?: any[] } }).properties?.periods ?? []) as any[];
    const period = nearestByTime(periods, request.firstPitchIso, (item) => item.startTime);
    if (!period) {
      return { ok: false, error: "NWS hourly forecast did not include usable periods" };
    }

    return {
      ok: true,
      data: {
        source: "nws",
        temperatureF: period.temperature,
        windSpeedMph: parseWindSpeed(period.windSpeed),
        windDirection: period.windDirection,
        shortForecast: period.shortForecast,
        observedAt: period.startTime,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: `NWS weather request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function fetchOpenMeteoWeather(
  request: WeatherRequest,
  fetchImpl: FetchLike
): Promise<ProviderResult<GameWeather>> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(request.latitude));
  url.searchParams.set("longitude", String(request.longitude));
  url.searchParams.set("hourly", "temperature_2m,wind_speed_10m,wind_direction_10m");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "UTC");

  return fetchOpenMeteoWeatherFromUrl(url, request.firstPitchIso, fetchImpl);
}

async function fetchOpenMeteoWeatherFromUrl(
  url: URL,
  firstPitchIso: string,
  fetchImpl: FetchLike
): Promise<ProviderResult<GameWeather>> {
  try {
    const response = await fetchImpl(url.toString());
    if (!response.ok) {
      return {
        ok: false,
        error: `Open-Meteo request failed with status ${response.status}`,
        status: response.status,
      };
    }

    const body = await response.json();
    const hourly = (body as { hourly?: Record<string, unknown[]> }).hourly;
    const times = (hourly?.time ?? []) as string[];
    const index = nearestTimeIndex(times, firstPitchIso);

    if (!hourly || index === -1) {
      return { ok: false, error: "Open-Meteo response did not include usable hourly data" };
    }

    return {
      ok: true,
      data: {
        source: "open-meteo",
        temperatureF: numberAt(hourly.temperature_2m, index),
        windSpeedMph: numberAt(hourly.wind_speed_10m, index),
        windDirection: degreesToCompass(numberAt(hourly.wind_direction_10m, index)),
        observedAt: times[index],
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: `Open-Meteo request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function isoDateOnly(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return dateIso.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function nearestByTime<T>(items: T[], targetIso: string, getTime: (item: T) => string | undefined): T | undefined {
  const index = nearestTimeIndex(items.map((item) => getTime(item) ?? ""), targetIso);
  return index === -1 ? undefined : items[index];
}

function nearestTimeIndex(times: string[], targetIso: string): number {
  const target = new Date(targetIso).getTime();
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  times.forEach((time, index) => {
    const normalized = time.endsWith("Z") || time.includes("+") ? time : `${time}Z`;
    const value = new Date(normalized).getTime();
    if (Number.isNaN(value)) {
      return;
    }

    const distance = Math.abs(value - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function parseWindSpeed(value: string | undefined): number | undefined {
  const match = value?.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function numberAt(values: unknown[] | undefined, index: number): number | undefined {
  const value = values?.[index];
  return typeof value === "number" ? value : undefined;
}

function degreesToCompass(degrees: number | undefined): string | undefined {
  if (degrees === undefined) {
    return undefined;
  }

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % directions.length;
  return directions[index];
}
