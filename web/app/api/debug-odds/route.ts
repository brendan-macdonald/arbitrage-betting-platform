import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/debug-odds
 * Optional: ?limit=5 (number of sample rows to include)
 *
 * Returns:
 * - counts for Event/Market/Odds
 * - distinct Market.type values
 * - distinct Odds.outcome values
 * - max(lastSeenAt)
 * - a few sample Markets with their Odds + Sportsbook names
 */
// Debug endpoint for odds DB. Returns counts, distinct types, and sample rows.
export async function GET(request: Request) {
  const url = new URL(request.url);
  // Optional limit param for sample size
  const limit = Number(url.searchParams.get("limit") ?? "5");

  // Aggregate counts for sanity checks
  const [eventCount, marketCount, oddsCount] = await Promise.all([
    prisma.event.count(),
    prisma.market.count(),
    prisma.odds.count(),
  ]);

  // Get distinct market/outcome types and max lastSeenAt
  const [marketTypes, outcomeTypes, maxSeen] = await Promise.all([
    prisma.market.findMany({ select: { type: true }, distinct: ["type"] }),
    prisma.odds.findMany({ select: { outcome: true }, distinct: ["outcome"] }),
    prisma.odds.aggregate({ _max: { lastSeenAt: true } }),
  ]);

  // Sample markets for UI/debug
  const sampleMarkets = await prisma.market.findMany({
    include: {
      event: true,
      odds: { include: { sportsbook: true } },
    },
  });

  // Shape response for quick inspection
  return NextResponse.json({
    counts: { eventCount, marketCount, oddsCount },
    distinct: {
      marketTypes: marketTypes.map((m) => m.type),
      outcomeTypes: outcomeTypes.map((o) => o.outcome),
    },
    lastSeenAtMax: maxSeen._max.lastSeenAt,
    sampleMarkets: sampleMarkets.map((m) => ({
      id: m.id,
      type: m.type,
      event: {
        league: m.event.league,
        teamA: m.event.teamA,
        teamB: m.event.teamB,
        startsAt: m.event.startsAt,
      },
      odds: m.odds.map((o) => ({
        sportsbook: o.sportsbook.name,
        outcome: o.outcome,
        dec: o.decimal,
        lastSeenAt: o.lastSeenAt,
      })),
    })),
  });
}
