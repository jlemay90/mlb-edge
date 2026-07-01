export function americanToDecimal(odds: number): number {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function americanToImplied(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
}

export function impliedToAmerican(probability: number): number {
  if (probability <= 0 || probability >= 1) {
    throw new Error("Probability must be between 0 and 1");
  }

  return probability >= 0.5
    ? Math.round(-(probability / (1 - probability)) * 100)
    : Math.round(((1 - probability) / probability) * 100);
}

export function removeVigTwoWay(
  aOdds: number,
  bOdds: number
): { a: number; b: number; overround: number } {
  const aImplied = americanToImplied(aOdds);
  const bImplied = americanToImplied(bOdds);
  const overround = aImplied + bImplied;

  return {
    a: aImplied / overround,
    b: bImplied / overround,
    overround,
  };
}

export function calculateExpectedValue(modelProbability: number, odds: number): number {
  const decimalOdds = americanToDecimal(odds);
  const profitIfWin = decimalOdds - 1;
  return modelProbability * profitIfWin - (1 - modelProbability);
}

export function calculateClv(pickOdds: number, closingOdds: number): number {
  return americanToImplied(closingOdds) - americanToImplied(pickOdds);
}

