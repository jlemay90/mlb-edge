import { describe, expect, it } from "vitest";
import {
  americanToDecimal,
  americanToImplied,
  calculateClv,
  calculateExpectedValue,
  impliedToAmerican,
  removeVigTwoWay,
} from "../domain/odds";

describe("odds math", () => {
  it("converts American odds to implied probability", () => {
    expect(americanToImplied(-110)).toBeCloseTo(0.5238, 4);
    expect(americanToImplied(150)).toBeCloseTo(0.4, 4);
  });

  it("converts implied probability back to American odds", () => {
    expect(impliedToAmerican(0.6)).toBe(-150);
    expect(impliedToAmerican(0.4)).toBe(150);
  });

  it("removes vig from a two-way market", () => {
    const noVig = removeVigTwoWay(-110, -110);
    expect(noVig.a).toBeCloseTo(0.5, 5);
    expect(noVig.b).toBeCloseTo(0.5, 5);
    expect(noVig.overround).toBeGreaterThan(1);
  });

  it("calculates expected value per unit stake", () => {
    expect(calculateExpectedValue(0.55, -110)).toBeCloseTo(0.05, 2);
  });

  it("calculates closing-line value as probability improvement", () => {
    expect(calculateClv(-110, -130)).toBeGreaterThan(0);
  });

  it("converts American odds to decimal odds", () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.909, 3);
    expect(americanToDecimal(150)).toBeCloseTo(2.5, 3);
  });
});

