/**
 * GET /api/opportunities
 * Query:
 *  - minRoi   (default 0) ROI on stake, e.g. 0.01 = 1%
 *  - freshMins (default 240) freshness window in minutes
 *  - maxSum   (default 1) allow near-arbs: 1/a + 1/b <= maxSum (set 1.005 to show near-arbs)
 *  - books    (optional CSV) only include these sportsbooks by name (case-insensitive)
 *
 * Examples:
 *  /api/opportunities?minRoi=0&freshMins=240
 *  /api/opportunities?minRoi=-0.01&freshMins=480&maxSum=1.005&books=draftkings,fanduel,betmgm,caesars
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { type Opportunity, type Leg } from "@/lib/arbitrage";

function roiOnStake(a: number, b: number) {
  const s = 1 / a + 1 / b;             // implied prob sum
  return (1 - s) / s;                   // negative if s > 1 (near-arb)
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const minRoi   = Number(url.searchParams.get("minRoi") ?? "0");
  const freshMins = Number(url.searchParams.get("freshMins") ?? "240");
  const maxSum   = Number(url.searchParams.get("maxSum") ?? "1");   // 1 = true arbs only
  const booksCsv = url.searchParams.get("books")?.trim();
    const sportKey = url.searchParams.get("sport"); // e.g., "americanfootball_ncaaf"
  const bookWhitelist = booksCsv
    ? booksCsv.split(",").map(b => b.trim().toLowerCase()).filter(Boolean)
    : null;

  const FRESH_MS = freshMins * 60_000;
  const now = Date.now();

  // Your debug showed type="ML" and outcomes "A"/"B"
  const markets = await prisma.market.findMany({
    where: {
      type: "ML",
      ...(sportKey
        ? {
            event: {
              OR: [{ sport: sportKey }, { league: sportKey }],
            },
          }
        : {}),
    },
    include: {
      event: true,
      odds: { include: { sportsbook: true } },
    },
    take: 100, // limit to 100 records for performance
  });

  const results: Opportunity[] = [];

  for (const m of markets) {
    // filter odds by freshness + optional book whitelist
    const A = m.odds.filter(o => {
      if (o.outcome !== "A") return false;
      if (now - new Date(o.lastSeenAt).getTime() > FRESH_MS) return false;
      if (bookWhitelist && !bookWhitelist.includes(o.sportsbook.name.toLowerCase())) return false;
      return true;
    });

    const B = m.odds.filter(o => {
      if (o.outcome !== "B") return false;
      if (now - new Date(o.lastSeenAt).getTime() > FRESH_MS) return false;
      if (bookWhitelist && !bookWhitelist.includes(o.sportsbook.name.toLowerCase())) return false;
      return true;
    });

    for (const ao of A) {
      for (const bo of B) {
        if (ao.sportsbookId === bo.sportsbookId) continue;  // cross-book only

        const sum = 1/ao.decimal + 1/bo.decimal;
        if (sum > maxSum) continue;                          // allow near-arbs if you set >1

        const roi = roiOnStake(ao.decimal, bo.decimal);
  if (roi < 0.01) continue; // Only show arbs with ROI > 1%

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

  results.sort((x, y) => y.roi - x.roi);
  return NextResponse.json(results);
}
