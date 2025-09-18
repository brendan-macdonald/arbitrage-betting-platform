/**
 * GET /api/opportunities
 *
 * For MVP we COMPUTE opportunities from raw odds at request time.
 * There is no "Opportunity" table yet — fewer moving parts while learning.
 * The UI shape stays identical to your stub for a zero-change frontend.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { twoWayArbROI, type Opportunity, type Leg } from "@/lib/arbitrage";

export async function GET() {
  // 1) Load all ML markets with their odds and event info in ONE query
  //    include: pulls in related rows so we can render cards immediately
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
    // Split odds into A and B by outcome
    const A = m.odds.filter((o) => o.outcome === "A");
    const B = m.odds.filter((o) => o.outcome === "B");

    // Cross-product of A and B: try every book pairing
    for (const ao of A) {
      for (const bo of B) {
        const roi = twoWayArbROI(ao.decimal, bo.decimal); // math lives in lib/
        if (roi <= 0) continue;

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

  // 3) Sort by ROI so the best opportunities show first
  results.sort((x, y) => y.roi - x.roi);

  return NextResponse.json(results);
}
