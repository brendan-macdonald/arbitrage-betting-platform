/**
 * GET /api/opportunities?minRoi=0.01
 *
 * - Computes 2-way arbitrage from raw odds at request time (no Opportunity table).
 * - Optional query: minRoi (decimal) — e.g., 0.01 = 1% threshold.
 * - Returns only opportunities with roi >= minRoi (default 0).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { twoWayArbROI, type Opportunity, type Leg } from "@/lib/arbitrage";

export async function GET(request: Request) {
  // 0) Read threshold from query string. Defaults to 0 (show all arbs).
  const url = new URL(request.url);
  const minRoi = Number(url.searchParams.get("minRoi") ?? "0"); // e.g. 0.01 = 1%

  // 1) Load all ML markets with their odds and event info in ONE query
  const markets = await prisma.market.findMany({
    where: { type: "ML" },
    include: {
      odds: { include: { sportsbook: true } },
      event: true,
    },
  });

  // 2) Compute 2-way arbitrage across all (A odds) x (B odds) pairs
  const results: Opportunity[] = [];

  for (const m of markets) {
    const A = m.odds.filter((o) => o.outcome === "A");
    const B = m.odds.filter((o) => o.outcome === "B");

    for (const ao of A) {
      for (const bo of B) {
        const roi = twoWayArbROI(ao.decimal, bo.decimal);
        if (roi <= 0) continue;              // must be a real arb
        if (roi < minRoi) continue;          // apply min ROI filter

        const legs: Leg[] = [
          { book: ao.sportsbook.name, outcome: "A", dec: ao.decimal },
          { book: bo.sportsbook.name, outcome: "B", dec: bo.decimal },
        ];

        results.push({
          id: `${m.id}-${ao.sportsbookId}-${bo.sportsbookId}`,
          sport: m.event.sport,
          league: m.event.league ?? m.event.sport,
          startsAt: m.event.startsAt.toISOString(),
          teamA: m.event.teamA,
          teamB: m.event.teamB,
          roi,
          legs,
        });
      }
    }
  }

  // 3) Sort best-first
  results.sort((x, y) => y.roi - x.roi);

  return NextResponse.json(results);
}
