import { describe, it, expect } from "vitest";
import { payoutCentsForWin } from "./db";

describe("payoutCentsForWin — American odds payout math", () => {
  it("computes plus-money payout (stake + profit)", () => {
    // +145 on $10 → 10 + 14.5 = $24.50 → 2450 cents
    expect(payoutCentsForWin(1000, 145)).toBe(2450);
  });

  it("computes minus-money payout (stake + profit)", () => {
    // -110 on $11 → 11 + 10 = $21 → 2100 cents
    expect(payoutCentsForWin(1100, -110)).toBe(2100);
  });

  it("even money +100 doubles the stake", () => {
    expect(payoutCentsForWin(5000, 100)).toBe(10000);
  });

  it("handles steep favorites", () => {
    // -400 on $40 → 40 + 10 = $50 → 5000 cents
    expect(payoutCentsForWin(4000, -400)).toBe(5000);
  });

  it("handles big underdog", () => {
    // +900 on $10 → 10 + 90 = $100 → 10000 cents
    expect(payoutCentsForWin(1000, 900)).toBe(10000);
  });

  it("rounds to whole cents", () => {
    // -110 on $10 → 10 + 9.0909.. = 19.0909 → 1909 cents
    expect(payoutCentsForWin(1000, -110)).toBe(1909);
  });
});
