import axios from "axios";

const res = await axios.get("http://localhost:3000/api/trpc/mlb.getTodaysGames?input=%7B%7D");
const games = res.data?.result?.data;

if (!games || games.length === 0) {
  console.log("No games returned yet");
  process.exit(0);
}

console.log(`\n=== REAL WEATHER AUDIT (${games.length} games) ===\n`);
for (const g of games) {
  const away = g.awayTeam?.name || g.awayTeam;
  const home = g.homeTeam?.name || g.homeTeam;
  const w = g.weather || {};
  const isDefault = w.temp === 72 && w.windSpeed === 8 && w.conditions === "Clear";
  const label = isDefault ? "⚠️  DEFAULT" : "✅ LIVE";
  console.log(`${label} | ${away} @ ${home}`);
  console.log(`       Temp: ${w.temp}°F | Wind: ${w.windSpeed} mph ${w.windDir} | ${w.conditions}`);
  console.log(`       Humidity: ${w.humidity}% | Precip: ${w.precipChance}% | Run Impact: ${w.runImpact} runs`);
  console.log();
}
