import axios from "axios";

async function audit() {
  try {
    const res = await axios.get("http://localhost:3000/api/trpc/mlb.getTopPicks", {
      params: { input: JSON.stringify({}) },
      timeout: 30000,
    });
    const picks = res.data?.result?.data;
    if (!picks || !picks.length) {
      console.log("No picks returned");
      return;
    }
    const p = picks[0];
    console.log("=== PICK FIELD AUDIT ===");
    console.log("Total picks:", picks.length);
    console.log("A-grade:", picks.filter(x => x.confidenceTier === "A").length);
    console.log("B-grade:", picks.filter(x => x.confidenceTier === "B").length);
    console.log("");
    console.log("--- Top Pick ---");
    console.log("pickLabel:", p.pickLabel);
    console.log("market:", p.market);
    console.log("edge:", p.edge, typeof p.edge, "isNaN:", isNaN(p.edge));
    console.log("edgeScore:", p.edgeScore, typeof p.edgeScore);
    console.log("bookImplied:", p.bookImplied, typeof p.bookImplied);
    console.log("impliedProbability:", p.impliedProbability);
    console.log("modelProbability:", p.modelProbability);
    console.log("confidenceTier:", p.confidenceTier);
    console.log("rationale:", (p.rationale || "").slice(0, 100));
    console.log("odds:", p.odds);
    console.log("homePitcher:", p.homePitcher);
    console.log("awayPitcher:", p.awayPitcher);
    console.log("");
    console.log("=== GAME FIELD AUDIT ===");
    const gres = await axios.get("http://localhost:3000/api/trpc/mlb.getTodaysGames", {
      params: { input: JSON.stringify({}) },
      timeout: 30000,
    });
    const games = gres.data?.result?.data;
    if (!games || !games.length) { console.log("No games"); return; }
    const g = games[0];
    console.log("Total games:", games.length);
    console.log("--- First Game ---");
    console.log("homeTeam:", g.homeTeam?.name, g.homeTeam?.record);
    console.log("awayTeam:", g.awayTeam?.name, g.awayTeam?.record);
    console.log("venue:", g.venue);
    console.log("homePitcher (object?):", typeof g.homePitcher, g.homePitcher?.name, "ERA:", g.homePitcher?.era);
    console.log("awayPitcher (object?):", typeof g.awayPitcher, g.awayPitcher?.name, "ERA:", g.awayPitcher?.era);
    console.log("umpire (object?):", typeof g.umpire, g.umpire?.name, "zone:", g.umpire?.strikeZoneSize, "runsPerGame:", g.umpire?.runsPerGame);
    console.log("weather (object?):", typeof g.weather, "temp:", g.weather?.temp, "windSpeed:", g.weather?.windSpeed, "windDir:", g.weather?.windDir, "runImpact:", g.weather?.runImpact);
    console.log("parkFactor:", g.parkFactor?.runs, g.parkFactor?.hr, g.parkFactor?.altitude);
    console.log("odds:", JSON.stringify(g.odds));
    console.log("predictions.topPick:", g.predictions?.topPick?.pickLabel, "edge:", g.predictions?.topPick?.edge);
    console.log("predictions.moneyLine:", g.predictions?.moneyLine?.pickLabel, "edge:", g.predictions?.moneyLine?.edge);
    console.log("predictions.total:", g.predictions?.total?.pickLabel, "edge:", g.predictions?.total?.edge);
  } catch (err) {
    console.error("Audit failed:", err.message);
  }
}

audit();
