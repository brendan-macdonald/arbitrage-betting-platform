// ---------------------------------------------------------
// Arbitrage helpers for ML, SPREAD, TOTAL
// ---------------------------------------------------------

// lib/arbitrage.ts

/**
 * Two-way arbitrage ROI given decimal odds a and b.
 * - Arbitrage exists if (1/a + 1/b) < 1
 * - Stake fractions: stakeA = 1/a, stakeB = 1/b, total s = 1/a + 1/b
 * - Guaranteed payout = 1, profit = 1 - s
 * - ROI (on capital) = profit / s = (1 - s) / s
 */

/**
 * Calculate arbitrage ROI percent for two decimal odds.
 * Returns percent (e.g. 1.2 for 1.2%).
 */
export function roiPct(a: number, b: number): number {
  const s = 1 / a + 1 / b;
  if (s >= 1) return 0;
  return (1 - s) / s * 100;
}

/**
 * Calculate stake split for target total stake.
 * Returns { stakeA, stakeB }.
 */
export function stakeSplit(target: number, a: number, b: number) {
  const s = 1 / a + 1 / b;
  return {
    stakeA: target * (1 / a) / s,
    stakeB: target * (1 / b) / s,
  };
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
  market?: 'ML' | 'SPREAD' | 'TOTAL';
  outcome: "A" | "B" | "OVER" | "UNDER";
  dec: number;             // decimal odds
  line?: number;           // for SPREAD/TOTAL
};
/**
 * Find best ML arbitrage opportunity from lines.
 * Returns {roi, legs} or null.
 */
export function findMlArb(lines: Array<{ book: string; outcome: 'A' | 'B'; decimal: number }>) {
  type Line = { book: string; outcome: 'A' | 'B'; decimal: number };
  let bestA: Line | null = null, bestB: Line | null = null;
  for (const l of lines) {
    if (l.outcome === 'A' && (!bestA || l.decimal > bestA.decimal)) bestA = l;
    if (l.outcome === 'B' && (!bestB || l.decimal > bestB.decimal)) bestB = l;
  }
  if (!bestA || !bestB) return null;
  const roi = roiPct(bestA.decimal, bestB.decimal);
  if (roi <= 0) return null;
  return {
    roi,
    legs: [
      { book: bestA.book, market: 'ML', outcome: 'A', dec: bestA.decimal },
      { book: bestB.book, market: 'ML', outcome: 'B', dec: bestB.decimal },
    ],
  };
}

/**
 * Find all spread arbitrage opportunities from lines.
 * Returns array of {roi, line, legs}.
 */
export function findSpreadArbs(lines: Array<{ book: string; market: 'SPREAD'; outcome: 'A' | 'B'; decimal: number; line: number }>) {
  type SpreadLine = { book: string; market: 'SPREAD'; outcome: 'A' | 'B'; decimal: number; line: number };
  const byLine = new Map<number, { A: SpreadLine[]; B: SpreadLine[] }>();
  for (const l of lines) {
    if (!byLine.has(l.line)) byLine.set(l.line, { A: [], B: [] });
    byLine.get(l.line)![l.outcome].push(l);
  }
  const arbs = [];
  for (const [line, { A, B }] of byLine.entries()) {
    if (!A.length || !B.length) continue;
    const bestA = A.reduce((a, b) => a.decimal > b.decimal ? a : b);
    const bestB = B.reduce((a, b) => a.decimal > b.decimal ? a : b);
    const roi = roiPct(bestA.decimal, bestB.decimal);
    if (roi > 0) {
      arbs.push({
        roi,
        line,
        legs: [
          { book: bestA.book, market: 'SPREAD', outcome: 'A', dec: bestA.decimal, line },
          { book: bestB.book, market: 'SPREAD', outcome: 'B', dec: bestB.decimal, line },
        ],
      });
    }
  }
  return arbs;
}

/**
 * Find all total arbitrage opportunities from lines.
 * Returns array of {roi, line, legs}.
 */
export function findTotalArbs(lines: Array<{ book: string; market: 'TOTAL'; outcome: 'OVER' | 'UNDER'; decimal: number; line: number }>) {
  type TotalLine = { book: string; market: 'TOTAL'; outcome: 'OVER' | 'UNDER'; decimal: number; line: number };
  const byLine = new Map<number, { OVER: TotalLine[]; UNDER: TotalLine[] }>();
  for (const l of lines) {
    if (!byLine.has(l.line)) byLine.set(l.line, { OVER: [], UNDER: [] });
    byLine.get(l.line)![l.outcome].push(l);
  }
  const arbs = [];
  for (const [line, { OVER, UNDER }] of byLine.entries()) {
    if (!OVER.length || !UNDER.length) continue;
    const bestO = OVER.reduce((a, b) => a.decimal > b.decimal ? a : b);
    const bestU = UNDER.reduce((a, b) => a.decimal > b.decimal ? a : b);
    const roi = roiPct(bestO.decimal, bestU.decimal);
    if (roi > 0) {
      arbs.push({
        roi,
        line,
        legs: [
          { book: bestO.book, market: 'TOTAL', outcome: 'OVER', dec: bestO.decimal, line },
          { book: bestU.book, market: 'TOTAL', outcome: 'UNDER', dec: bestU.decimal, line },
        ],
      });
    }
  }
  return arbs;
}

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
  const roi = roiPct(ev.a[0].dec, ev.b[0].dec);

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