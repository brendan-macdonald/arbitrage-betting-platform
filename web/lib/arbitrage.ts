// ---------------------------------------------------------
// Function: twoWayArbROI
// Purpose:  Calculates whether a 2-way arbitrage exists, and
//           if so, returns the Return on Investment (ROI).
//
// Arbitrage math refresher:
//   - In a 2-outcome market (like moneyline win/lose), odds can
//     be converted into implied probabilities as 1 / odds.
//   - If sum(1/oddsA + 1/oddsB) < 1, there’s an arbitrage (a guaranteed profit).
//   - ROI = 1 - (sum of implied probabilities).
// Example: oddsA=2.08, oddsB=1.95 → invSum ≈ 0.4808 + 0.5128 = 0.9936.
//          ROI = 1 - 0.9936 ≈ 0.0064 = 0.64% guaranteed profit.
// ---------------------------------------------------------

/**
 * Given two decimal odds (one for Team A, one for Team B),
 * calculate if an arbitrage exists.
 *
 * Formula:
 *   If (1/oddsA + 1/oddsB) < 1 → guaranteed profit.
 *   ROI = 1 - (1/oddsA + 1/oddsB)
 *
 * Example:
 *   oddsA = 2.08, oddsB = 1.90
 *   1/2.08 + 1/1.90 = 0.961 < 1
 *   ROI = 0.039 → 3.9% profit
 */
export function twoWayArbROI(decA: number, decB: number): number {
  const invSum = 1 / decA + 1 / decB;
  return invSum < 1 ? 1 - invSum : 0;
}

  /**
 * TypeScript "type" = documentation + safety.
 * It describes what shape of object we expect,
 * but disappears when code runs.
 *
 * Example Leg:
 * {
 *   book: "FanDuel",
 *   outcome: "A",
 *   dec: 2.08
 * }
 */

export type Leg = {
  book: string;            // sportsbook name
  outcome: "A" | "B";      // which side of the bet
  dec: number;             // decimal odds
};

/**
 * A single arbitrage opportunity, which contains:
 * - Basic event info (sport, teams, start time)
 * - ROI (return on investment as a decimal, e.g. 0.012 = 1.2%)
 * - The specific bets (legs) to place across books
 */

export type Opportunity = {
  id: string;
  sport: string;
  league: string;
  startsAt: string; // store as ISO string for simplicity
  teamA: string;
  teamB: string;
  roi: number;
  legs: Leg[];
};

/**
 * For now, this function just returns a hardcoded "stub"
 * opportunity so the UI has something to display.
 * Later, we'll swap this out for DB + scraping.
 */
export function findStubOpportunities(): Opportunity[] {
  // Example game
  const ev = {
    id: "E1",
    sport: "NBA",
    league: "NBA",
    startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
    teamA: "BOS",
    teamB: "NYK",
    a: [{ book: "FanDuel", dec: 2.12 }],    // Team A odds
    b: [{ book: "DraftKings", dec: 1.90 }], // Team B odds
  };

  // Run arb math: does this pair produce a positive ROI?
  const roi = twoWayArbROI(ev.a[0].dec, ev.b[0].dec);

  // If yes → return a single Opportunity array.
  // If not → return empty array.
  return roi > 0
    ? [{
        id: `${ev.id}-${ev.a[0].book}-${ev.b[0].book}`,
        sport: ev.sport,
        league: ev.league,
        startsAt: ev.startsAt,
        teamA: ev.teamA,
        teamB: ev.teamB,
        roi, // decimal, e.g. 0.039
        legs: [
          { book: ev.a[0].book, outcome: "A", dec: ev.a[0].dec },
          { book: ev.b[0].book, outcome: "B", dec: ev.b[0].dec },
        ],
      }]
    : [];
}