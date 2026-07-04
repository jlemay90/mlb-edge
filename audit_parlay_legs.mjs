#!/usr/bin/env node
/**
 * MLB Edge — Parlay Leg Audit
 *
 * Problem: Parlay cards grade as one unit (lose 1 leg = whole parlay loses).
 *          This makes your record look worse than your actual pick performance.
 *
 * Solution: This script queries every graded leg across all parlays and reports
 *           the TRUE individual game record — how many individual picks actually won.
 *
 * Usage:
 *   node audit_parlay_legs.mjs              # full history
 *   node audit_parlay_legs.mjs 14           # last 14 days
 *   node audit_parlay_legs.mjs 7 detailed   # last 7 days, per-leg breakdown
 */

import mysql from "mysql2/promise";

const DAYS = parseInt(process.argv[2] || "0", 10); // 0 = all time
const DETAILED = process.argv.includes("detailed");

// ─── Config ───────────────────────────────────────────────────────────────────

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

const ALL_LEGS_SQL = `
  SELECT
    pl.id,
    pl.parlay_card_id,
    pl.game_pk,
    pl.game_date,
    pl.home_team,
    pl.away_team,
    pl.market,
    pl.pick,
    pl.pick_label,
    pl.odds,
    pl.edge_score,
    pl.model_probability,
    pl.reasoning,
    pl.result,
    pl.actual_outcome,
    pc.type AS parlay_type,
    pc.combined_odds AS parlay_odds,
    pc.result AS parlay_result,
    pc.legs_won,
    pc.legs_lost
  FROM parlay_legs pl
  JOIN parlay_cards pc ON pc.id = pl.parlay_card_id
  WHERE pl.result != 'pending'
  ${DAYS > 0 ? `AND pl.game_date >= DATE_SUB(CURDATE(), INTERVAL ${DAYS} DAY)` : ""}
  ORDER BY pl.game_date DESC, pl.parlay_card_id, pl.id
`;

const PARLAY_SUMMARY_SQL = `
  SELECT
    type,
    result,
    COUNT(*) as count,
    AVG(legs_won) as avg_legs_won,
    AVG(legs_lost) as avg_legs_lost,
    AVG(total_legs) as avg_total_legs
  FROM parlay_cards
  WHERE result != 'pending'
  ${DAYS > 0 ? `AND date >= DATE_SUB(CURDATE(), INTERVAL ${DAYS} DAY)` : ""}
  GROUP BY type, result
  ORDER BY type, result
`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function audit() {
  const conn = await mysql.createConnection(DB_URL);
  console.log("🔍 MLB Edge — Parlay Leg Audit");
  console.log(DAYS > 0 ? `   Scope: Last ${DAYS} days` : "   Scope: All time");
  console.log("");

  // ─── Pull all graded legs ──────────────────────────────────────────────────

  const [legs] = await conn.execute(ALL_LEGS_SQL);

  if (legs.length === 0) {
    console.log("No graded legs found. Run the grader first (gradeNow).");
    await conn.end();
    return;
  }

  // ─── Individual Leg Record (THE TRUTH) ────────────────────────────────────

  const legWins = legs.filter(l => l.result === "win").length;
  const legLosses = legs.filter(l => l.result === "loss").length;
  const legPushes = legs.filter(l => l.result === "push").length;
  const legTotal = legWins + legLosses; // pushes don't count for win rate
  const legWinPct = legTotal > 0 ? (legWins / legTotal) * 100 : 0;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("📊  INDIVIDUAL LEG RECORD (True Pick Performance)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`   Total Graded Legs : ${legs.length}`);
  console.log(`   Wins              : ${legWins}`);
  console.log(`   Losses            : ${legLosses}`);
  console.log(`   Pushes/Voids      : ${legPushes}`);
  console.log(`   Decisive Record   : ${legWins}-${legLosses}`);
  console.log(`   Win Rate          : ${legWinPct.toFixed(1)}%`);
  console.log(`   (breakeven at 52.4% for -110, 55.0% for -122)`);
  console.log("");

  // ─── By Market ──────────────────────────────────────────────────────────────

  const byMarket = {};
  for (const l of legs) {
    const m = l.market || "unknown";
    if (!byMarket[m]) byMarket[m] = { wins: 0, losses: 0, pushes: 0 };
    byMarket[m][l.result === "push" ? "pushes" : l.result + "s"]++;
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("📊  BY MARKET");
  console.log("═══════════════════════════════════════════════════════════");
  for (const [market, r] of Object.entries(byMarket)) {
    const total = r.wins + r.losses;
    const pct = total > 0 ? (r.wins / total) * 100 : 0;
    console.log(`   ${market.padEnd(12)} : ${String(r.wins).padStart(3)}-${String(r.losses).padStart(3)}  (${pct.toFixed(1)}%)  ${r.pushes > 0 ? "[" + r.pushes + " pushes]" : ""}`);
  }
  console.log("");

  // ─── By Edge Score Bracket ─────────────────────────────────────────────────

  const brackets = [
    { min: 0.15, label: "Elite (15%+ edge)" },
    { min: 0.10, label: "Strong (10-15% edge)" },
    { min: 0.07, label: "Solid (7-10% edge)" },
    { min: 0.05, label: "Moderate (5-7% edge)" },
    { min: 0.00, label: "Marginal (0-5% edge)" },
  ];

  console.log("═══════════════════════════════════════════════════════════");
  console.log("📊  BY EDGE SCORE (Model Confidence)");
  console.log("═══════════════════════════════════════════════════════════");
  for (const b of brackets) {
    const bucket = legs.filter(l => (l.edge_score ?? 0) >= b.min && (l.edge_score ?? 0) < (b.min + 0.05));
    if (bucket.length === 0) continue;
    const bw = bucket.filter(l => l.result === "win").length;
    const bl = bucket.filter(l => l.result === "loss").length;
    const bt = bw + bl;
    const bp = bt > 0 ? (bw / bt) * 100 : 0;
    console.log(`   ${b.label.padEnd(28)} : ${String(bw).padStart(3)}-${String(bl).padStart(3)}  (${bp.toFixed(1)}%)  n=${bt}`);
  }
  console.log("");

  // ─── Parlay-Level Record (What the UI Shows) ───────────────────────────────

  const [parlaySummary] = await conn.execute(PARLAY_SUMMARY_SQL);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("🎰  PARLAY-LEVEL RECORD (What Your UI Currently Shows)");
  console.log("═══════════════════════════════════════════════════════════");

  const parlayTypes = ["power", "value", "lotto", "highvalue", "hrprop"];
  let totalParlayWins = 0, totalParlayLosses = 0, totalParlayPushes = 0;

  for (const type of parlayTypes) {
    const rows = parlaySummary.filter(r => r.type === type);
    if (rows.length === 0) continue;
    const pw = rows.find(r => r.result === "win")?.count ?? 0;
    const pl = rows.find(r => r.result === "loss")?.count ?? 0;
    const pp = rows.find(r => r.result === "push")?.count ?? 0;
    totalParlayWins += pw;
    totalParlayLosses += pl;
    totalParlayPushes += pp;
    const pt = pw + pl;
    const ppct = pt > 0 ? (pw / pt) * 100 : 0;
    const avgLegs = rows[0]?.avg_total_legs ?? "?";
    console.log(`   ${type.padEnd(12)} : ${String(pw).padStart(3)}-${String(pl).padStart(3)}  (${ppct.toFixed(1)}%)  avg ${avgLegs} legs  ${pp > 0 ? "[" + pp + " pushes]" : ""}`);
  }

  const totalParlayT = totalParlayWins + totalParlayLosses;
  const totalParlayPct = totalParlayT > 0 ? (totalParlayWins / totalParlayT) * 100 : 0;
  console.log(`   ${"TOTAL".padEnd(12)} : ${String(totalParlayWins).padStart(3)}-${String(totalParlayLosses).padStart(3)}  (${totalParlayPct.toFixed(1)}%)${totalParlayPushes > 0 ? " [" + totalParlayPushes + " pushes]" : ""}`);
  console.log("");

  // ─── The Parallax Effect ───────────────────────────────────────────────────

  console.log("═══════════════════════════════════════════════════════════");
  console.log("⚠️   THE PARLAY PENALTY (Why Parlays Look 'Unfair')");
  console.log("═══════════════════════════════════════════════════════════");

  // Count legs that won inside losing parlays
  const winningLegsInLosingParlays = legs.filter(l => l.result === "win" && l.parlay_result === "loss").length;
  const losingLegsInLosingParlays = legs.filter(l => l.result === "loss" && l.parlay_result === "loss").length;
  const pushLegsInLosingParlays = legs.filter(l => l.result === "push" && l.parlay_result === "loss").length;

  console.log(`   You picked ${legWins} individual winners out of ${legTotal} decisive legs`);
  console.log(`   → That's a ${legWinPct.toFixed(1)}% win rate on individual picks`);
  console.log("");
  console.log(`   But ${winningLegsInLosingParlays} of those winning legs were`);
  console.log(`   inside parlays that LOST because of another leg.`);
  console.log(`   Those winners were WASTED.`);
  console.log("");
  console.log(`   Your parlay record is ${totalParlayWins}-${totalParlayLosses} (${totalParlayPct.toFixed(1)}%)`);
  console.log(`   Your leg record is     ${legWins}-${legLosses} (${legWinPct.toFixed(1)}%)`);
  console.log(`   The gap: ${(legWinPct - totalParlayPct).toFixed(1)} percentage points hidden by parlay math.`);
  console.log("");

  // ─── Per-Parlay Breakdown of Losses ────────────────────────────────────────

  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔍  WHY LOSING PARLAYS LOST (Leg-by-Leg in Failed Parlays)");
  console.log("═══════════════════════════════════════════════════════════");

  const losingParlayIds = [...new Set(legs.filter(l => l.parlay_result === "loss").map(l => l.parlay_card_id))];
  const losingParlays = {};

  for (const lid of losingParlayIds) {
    const cardLegs = legs.filter(l => l.parlay_card_id === lid);
    const w = cardLegs.filter(l => l.result === "win").length;
    const ls = cardLegs.filter(l => l.result === "loss").length;
    const p = cardLegs.filter(l => l.result === "push").length;
    const type = cardLegs[0]?.parlay_type || "unknown";
    const key = `${w}W-${ls}L${p > 0 ? "-" + p + "P" : ""}`;
    const label = `${type} (${cardLegs.length} legs)`;
    if (!losingParlays[key]) losingParlays[key] = {};
    if (!losingParlays[key][label]) losingParlays[key][label] = 0;
    losingParlays[key][label]++;
  }

  for (const [split, types] of Object.entries(losingParlays)) {
    const totalOfSplit = Object.values(types).reduce((a, b) => a + b, 0);
    console.log(`   ${split} — ${totalOfSplit} parlay(s)`);
    for (const [t, c] of Object.entries(types)) {
      console.log(`      ${t}: ${c}`);
    }
  }
  console.log("");

  // ─── Detailed Mode ─────────────────────────────────────────────────────────

  if (DETAILED) {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📋  EVERY GRADED LEG");
    console.log("═══════════════════════════════════════════════════════════");

    const byDate = {};
    for (const l of legs) {
      if (!byDate[l.game_date]) byDate[l.game_date] = [];
      byDate[l.game_date].push(l);
    }

    for (const [date, dateLegs] of Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]))) {
      console.log(`\n--- ${date} ---`);
      for (const l of dateLegs) {
        const icon = l.result === "win" ? "✅" : l.result === "loss" ? "❌" : "➖";
        const parlayIcon = l.parlay_result === "win" ? "🟢" : l.parlay_result === "loss" ? "🔴" : "⚪";
        console.log(`  ${icon} ${parlayIcon} [${l.parlay_type?.toUpperCase()?.padEnd(10)}] ${l.pick_label || l.pick}  (${l.market}, ${l.odds > 0 ? "+" + l.odds : l.odds})  edge:${((l.edge_score ?? 0) * 100).toFixed(0)}%`);
        if (l.result === "loss" && l.actual_outcome) {
          console.log(`         → ${l.actual_outcome}`);
        }
      }
    }
  }

  // ─── Recommendations ───────────────────────────────────────────────────────

  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("💡  WHAT THIS MEANS FOR YOUR APP");
  console.log("═══════════════════════════════════════════════════════════");

  if (legWinPct >= 55) {
    console.log("   Your INDIVIDUAL picks are profitable. Parlays are hiding it.");
    console.log("   → Surface the leg-level record in your UI.");
    console.log("   → Consider promoting straight bets, not just parlays.");
  } else if (legWinPct >= 52.4) {
    console.log("   Your individual picks are roughly breakeven/slightly profitable.");
    console.log("   → Parlays are making you look worse than you are.");
    console.log("   → Show both records: parlay AND individual leg performance.");
  } else {
    console.log("   Even individual legs are below breakeven.");
    console.log("   → The model needs improvement before any bet format works.");
    console.log("   → Focus on edge > 10% legs only — check the bracket table above.");
  }

  console.log("");
  console.log("   Transparency recommendation:");
  console.log("   Show users BOTH numbers:");
  console.log(`     Parlay Record : ${totalParlayWins}-${totalParlayLosses}`);
  console.log(`     Leg Record    : ${legWins}-${legLosses} (${legWinPct.toFixed(1)}%)`);
  console.log("   This IS your radical transparency. Don't hide the gap.");
  console.log("   Explain it: 'Parlays multiply risk. Here's how our individual");
  console.log("   picks actually perform.'");
  console.log("");

  await conn.end();
}

audit().catch(err => {
  console.error("Audit failed:", err.message);
  process.exit(1);
});
