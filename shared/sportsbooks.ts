// MLB Edge — Sportsbook Affiliate Links
//
// Replace the `affiliateUrl` values with your actual affiliate/referral links
// once you've signed up for each sportsbook's affiliate program.
//
// Affiliate programs:
//   DraftKings: https://affiliates.draftkings.com
//   FanDuel:    https://affiliates.fanduel.com
//   BetMGM:     https://affiliates.betmgm.com
//   Caesars:    https://affiliates.caesarssportsbook.com
//   bet365:     https://affiliates.bet365.com
//
// Until you have real affiliate links, the base sportsbook URLs are used as
// fallbacks so the buttons still work and drive traffic.

export interface SportsbookConfig {
  id: string;
  name: string;
  shortName: string;
  affiliateUrl: string;
  logoColor: string;    // Tailwind text color class
  bgColor: string;      // Tailwind bg color class
  borderColor: string;  // Tailwind border color class
  states: string[];     // US states where legal (abbreviated)
}

export const SPORTSBOOKS: SportsbookConfig[] = [
  {
    id: "draftkings",
    name: "DraftKings Sportsbook",
    shortName: "DraftKings",
    // Replace with your DK affiliate link:
    affiliateUrl: "https://sportsbook.draftkings.com",
    logoColor: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    states: ["AZ","CO","CT","IL","IN","IA","KS","KY","LA","MD","MA","MI","NJ","NY","NC","OH","OR","PA","TN","VA","WV","WY"],
  },
  {
    id: "fanduel",
    name: "FanDuel Sportsbook",
    shortName: "FanDuel",
    // Replace with your FD affiliate link:
    affiliateUrl: "https://sportsbook.fanduel.com",
    logoColor: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    states: ["AZ","CO","CT","IL","IN","IA","KS","KY","LA","MD","MA","MI","NJ","NY","NC","OH","OR","PA","TN","VA","WV","WY"],
  },
  {
    id: "betmgm",
    name: "BetMGM Sportsbook",
    shortName: "BetMGM",
    // Replace with your BetMGM affiliate link:
    affiliateUrl: "https://sports.betmgm.com",
    logoColor: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    states: ["AZ","CO","DC","IL","IN","IA","KS","KY","LA","MD","MA","MI","MS","NJ","NY","NC","OH","PA","TN","VA","WV","WY"],
  },
  {
    id: "caesars",
    name: "Caesars Sportsbook",
    shortName: "Caesars",
    // Replace with your Caesars affiliate link:
    affiliateUrl: "https://sportsbook.caesars.com",
    logoColor: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    states: ["AZ","CO","IL","IN","IA","KS","KY","LA","MD","MA","MI","NJ","NY","NC","OH","PA","TN","VA","WV","WY"],
  },
];

// Helper: get a sportsbook by ID
export function getSportsbook(id: string): SportsbookConfig | undefined {
  return SPORTSBOOKS.find((s) => s.id === id);
}
