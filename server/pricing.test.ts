import { describe, it, expect } from "vitest";
import {
  STRIPE_PRODUCTS,
  FOUNDING_MEMBER_CAP,
  tierRank,
  hasAccess,
  TIER_GATES,
} from "./stripe/products";

describe("Pricing config — relaunch tiers", () => {
  it("has three paid tiers with correct display names", () => {
    expect(STRIPE_PRODUCTS.pro.name).toBe("Edge");
    expect(STRIPE_PRODUCTS.sharp.name).toBe("Sharp");
    expect(STRIPE_PRODUCTS.syndicate.name).toBe("Syndicate");
  });

  it("has correct monthly prices in cents", () => {
    expect(STRIPE_PRODUCTS.pro.monthlyPrice).toBe(999);
    expect(STRIPE_PRODUCTS.sharp.monthlyPrice).toBe(1999);
    expect(STRIPE_PRODUCTS.syndicate.monthlyPrice).toBe(4999);
  });

  it("has correct annual prices in cents", () => {
    expect(STRIPE_PRODUCTS.pro.annualPrice).toBe(9900);
    expect(STRIPE_PRODUCTS.sharp.annualPrice).toBe(19900);
    expect(STRIPE_PRODUCTS.syndicate.annualPrice).toBe(49900);
  });

  it("assigns a unique, non-empty lookup_key to every paid price", () => {
    const keys = [
      STRIPE_PRODUCTS.pro.monthlyLookupKey,
      STRIPE_PRODUCTS.pro.annualLookupKey,
      STRIPE_PRODUCTS.sharp.monthlyLookupKey,
      STRIPE_PRODUCTS.sharp.annualLookupKey,
      STRIPE_PRODUCTS.syndicate.monthlyLookupKey,
      STRIPE_PRODUCTS.syndicate.annualLookupKey,
    ];
    keys.forEach((k) => expect(k.length).toBeGreaterThan(0));
    expect(new Set(keys).size).toBe(keys.length); // all unique
  });

  it("locks the Founding-500 cap at 500", () => {
    expect(FOUNDING_MEMBER_CAP).toBe(500);
  });
});

describe("Tier access ranking", () => {
  it("ranks tiers free < edge < sharp < syndicate", () => {
    expect(tierRank("free")).toBeLessThan(tierRank("pro"));
    expect(tierRank("pro")).toBeLessThan(tierRank("sharp"));
    expect(tierRank("sharp")).toBeLessThan(tierRank("syndicate"));
  });

  it("grants higher tiers access to lower-tier features", () => {
    expect(hasAccess("syndicate", "sharp")).toBe(true);
    expect(hasAccess("syndicate", "pro")).toBe(true);
    expect(hasAccess("sharp", "pro")).toBe(true);
  });

  it("denies lower tiers access to higher-tier features", () => {
    expect(hasAccess("pro", "sharp")).toBe(false);
    expect(hasAccess("sharp", "syndicate")).toBe(false);
    expect(hasAccess("free", "pro")).toBe(false);
  });

  it("gates Syndicate-only features behind the syndicate tier", () => {
    expect(hasAccess("sharp", TIER_GATES.bankrollTracker)).toBe(false);
    expect(hasAccess("syndicate", TIER_GATES.bankrollTracker)).toBe(true);
    expect(hasAccess("syndicate", TIER_GATES.rawEdge)).toBe(true);
    expect(hasAccess("syndicate", TIER_GATES.earlyAccess)).toBe(true);
  });
});
