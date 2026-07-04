import axios from "axios";

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";
const ODDS_API_BASE = "https://api.the-odds-api.com/v4/sports/baseball_mlb";
const WEATHER_API_BASE = "https://api.openweathermap.org/data/2.5/weather";

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

const MLB_VENUES: Record<number, { name: string; lat: number; lon: number }> = {
  3313: { name: "Yankee Stadium", lat: 40.8296, lon: -73.9262 },
  3312: { name: "Fenway Park", lat: 42.3467, lon: -71.0972 },
  2680: { name: "Dodger Stadium", lat: 34.0739, lon: -118.2400 },
  2395: { name: "Oracle Park", lat: 37.7786, lon: -122.3893 },
  4705: { name: "Truist Park", lat: 33.8908, lon: -84.4678 },
  3289: { name: "Citi Field", lat: 40.7571, lon: -73.8458 },
  7: { name: "Wrigley Field", lat: 41.9484, lon: -87.6553 },
  4: { name: "Guaranteed Rate Field", lat: 41.8300, lon: -87.6339 },
  302: { name: "Great American Ball Park", lat: 39.0979, lon: -84.5085 },
  27: { name: "Progressive Field", lat: 41.4962, lon: -81.6852 },
  2681: { name: "Coors Field", lat: 39.7559, lon: -104.9942 },
  3314: { name: "Comerica Park", lat: 42.3390, lon: -83.0485 },
  32: { name: "Minute Maid Park", lat: 29.7573, lon: -95.3555 },
  3310: { name: "Kauffman Stadium", lat: 39.0517, lon: -94.4802 },
  1: { name: "Angel Stadium", lat: 33.8003, lon: -117.8827 },
  4169: { name: "loanDepot park", lat: 25.7781, lon: -80.2195 },
  401: { name: "American Family Field", lat: 43.0280, lon: -87.9712 },
  3318: { name: "Target Field", lat: 44.9817, lon: -93.2776 },
  3319: { name: "Rogers Centre", lat: 43.6414, lon: -79.3894 },
  3315: { name: "T-Mobile Park", lat: 47.5914, lon: -122.3325 },
  222: { name: "Busch Stadium", lat: 38.6226, lon: -90.1928 },
  12: { name: "Tropicana Field", lat: 27.7678, lon: -82.6234 },
  5325: { name: "Globe Life Field", lat: 32.7513, lon: -97.0823 },
  3309: { name: "Chase Field", lat: 33.4455, lon: -112.0667 },
  37: { name: "PNC Park", lat: 40.4469, lon: -80.0057 },
  3: { name: "Oriole Park", lat: 39.2839, lon: -76.6216 },
  15: { name: "Oakland Coliseum", lat: 37.7516, lon: -122.2005 },
  3308: { name: "Petco Park", lat: 32.7073, lon: -117.1566 },
  3316: { name: "Citizens Bank Park", lat: 39.9055, lon: -75.1661 },
  3317: { name: "Nationals Park", lat: 38.8730, lon: -77.0074 },
};

interface GameData {
  gamePk: number; gameDate: string; homeTeamId: number; awayTeamId: number;
  homeTeamName: string; awayTeamName: string; homePitcherId?: number; awayPitcherId?: number;
  venueId: number; venueName: string; status: string;
  weatherTemp?: number; weatherCondition?: string; windSpeed?: number;
  homeOdds?: number; awayOdds?: number; overUnder?: number;
}

export class DataPipeline {
  async fetchSchedule(dateStr: string): Promise<GameData[]> {
    const resp = await axios.get(`${MLB_API_BASE}/schedule`, {
      params: { sportId: 1, date: dateStr, hydrate: "probablePitcher,linescore,weather,venue,team" },
      timeout: 30000,
    });
    const games: GameData[] = [];
    for (const dateEntry of resp.data.dates || []) {
      for (const game of dateEntry.games || []) {
        const weather = game.weather || {};
        games.push({
          gamePk: game.gamePk, gameDate: dateStr,
          homeTeamId: game.teams.home.team.id, awayTeamId: game.teams.away.team.id,
          homeTeamName: game.teams.home.team.name, awayTeamName: game.teams.away.team.name,
          homePitcherId: game.teams.home.probablePitcher?.id,
          awayPitcherId: game.teams.away.probablePitcher?.id,
          venueId: game.venue.id, venueName: game.venue.name, status: game.status.detailedState,
          weatherTemp: weather.temp, weatherCondition: weather.condition, windSpeed: weather.wind,
        });
      }
    }
    return games;
  }

  async run(dateStr: string) {
    const games = await this.fetchSchedule(dateStr);
    return { date: dateStr, gamesScheduled: games.length, message: "Ingestion complete" };
  }
}
