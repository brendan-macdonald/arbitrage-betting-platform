// High-volume sports for this week (Sep 22, 2025)
export const SPORTS = [
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "baseball_mlb",
  "soccer_epl",
  "basketball_nba",
] as const;

export const SPORT_DISPLAY_NAMES: Record<string, string> = {
  americanfootball_nfl: "NFL Football",
  americanfootball_ncaaf: "NCAAF Football",
  baseball_mlb: "MLB Baseball",
  soccer_epl: "Soccer (EPL)",
  basketball_nba: "Basketball (NBA)",
};
