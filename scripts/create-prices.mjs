// One-time (idempotent) script: create Stripe products + prices for the relaunch tiers.
//   Edge      $9.99/mo  ($99/yr)
//   Sharp     $19.99/mo ($199/yr)
//   Syndicate $49.99/mo ($499/yr)
//
// Each price gets a stable lookup_key so application code can resolve the right
// price at runtime in BOTH test and live mode without hardcoding price IDs.
//
// Safe to re-run: it never deletes or mutates existing prices. If a lookup_key
// already exists, it reuses that price. Stripe forbids two active prices sharing
// a lookup_key, so on re-run we detect the existing one and skip creation.
//
// Usage:
//   STRIPE_SECRET_KEY=sk_live_xxx node scripts/create-prices.mjs
//   (run with the LIVE key to populate live mode; run with test key for test mode)
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live") ? "LIVE" : "TEST";
console.log(`Stripe mode: ${mode}\n`);

// lookup_key is the contract between this script and products.ts
const tiers = [
  { key: "edge", name: "MLB Edge — Edge", monthly: 999, annual: 9900 },
  { key: "sharp", name: "MLB Edge — Sharp", monthly: 1999, annual: 19900 },
  { key: "syndicate", name: "MLB Edge — Syndicate", monthly: 4999, annual: 49900 },
];

async function findByLookupKey(lookupKey) {
  const res = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  return res.data[0] || null;
}

async function ensurePrice({ productId, productName, lookupKey, amount, interval, tierKey }) {
  const existing = await findByLookupKey(lookupKey);
  if (existing) {
    console.log(`  reuse  ${lookupKey} -> ${existing.id} ($${(existing.unit_amount / 100).toFixed(2)})`);
    return existing;
  }
  // Need a product to attach to
  let product = productId;
  if (!product) {
    const created = await stripe.products.create({
      name: productName,
      metadata: { tier: tierKey, relaunch: "2026-06" },
    });
    product = created.id;
  }
  const price = await stripe.prices.create({
    product,
    unit_amount: amount,
    currency: "usd",
    recurring: { interval },
    nickname: `${tierKey} ${interval === "month" ? "monthly" : "annual"}`,
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    metadata: { tier: tierKey, interval },
  });
  console.log(`  create ${lookupKey} -> ${price.id} ($${(amount / 100).toFixed(2)})`);
  return price;
}

const out = {};

for (const t of tiers) {
  console.log(`Tier: ${t.key}`);
  // Try to reuse an existing product by finding any price already created for this tier
  const monthlyLk = `mlbedge_${t.key}_monthly`;
  const annualLk = `mlbedge_${t.key}_annual`;

  const existingMonthly = await findByLookupKey(monthlyLk);
  const productId = existingMonthly ? existingMonthly.product : null;

  const monthly = await ensurePrice({
    productId,
    productName: t.name,
    lookupKey: monthlyLk,
    amount: t.monthly,
    interval: "month",
    tierKey: t.key,
  });

  const annual = await ensurePrice({
    productId: monthly.product,
    productName: t.name,
    lookupKey: annualLk,
    amount: t.annual,
    interval: "year",
    tierKey: t.key,
  });

  out[t.key] = {
    productId: monthly.product,
    monthlyLookupKey: monthlyLk,
    monthlyPriceId: monthly.id,
    monthlyAmount: t.monthly,
    annualLookupKey: annualLk,
    annualPriceId: annual.id,
    annualAmount: t.annual,
  };
}

console.log(`\n=== RESULT JSON (${mode}) ===`);
console.log(JSON.stringify(out, null, 2));
