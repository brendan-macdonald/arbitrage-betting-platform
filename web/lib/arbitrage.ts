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

// lib/arbitrage.ts

/**
 * Two-way arbitrage ROI given decimal odds a and b.
 * - Arbitrage exists if (1/a + 1/b) < 1
 * - Stake fractions: stakeA = 1/a, stakeB = 1/b, total s = 1/a + 1/b
 * - Guaranteed payout = 1, profit = 1 - s
 * - ROI (on capital) = profit / s = (1 - s) / s
 */
export function twoWayArbROI(a: number, b: number): number {
  const s = 1 / a + 1 / b;
  if (s >= 1) return 0;
  return (1 - s) / s;
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