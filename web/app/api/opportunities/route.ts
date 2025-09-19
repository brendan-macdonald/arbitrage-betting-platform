/**
 * GET /api/opportunities?minRoi=0.01&freshMins=60
 * - Computes 2-way arbitrage from raw odds at request time (no Opportunity table).
 * - Accepts market type aliases (ML/H2H/h2h/Moneyline).
 * - Accepts outcome aliases (A/B vs home/away).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { twoWayArbROI, type Opportunity, type Leg } from "@/lib/arbitrage";

// Normalize outcome labels coming from provider/DB
function isOutcomeA(s: string) {
  const v = s.toLowerCase();
  return v === "a" || v === "away" || v === "visitor" || v === "teama";
}
function isOutcomeB(s: string) {
  const v = s.toLowerCase();
  return v === "b" || v === "home" || v === "favourite" || v === "favorite" || v === "teamb";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const minRoi = Number(url.searchParams.get("minRoi") ?? "0");
  const freshMins = Number(url.searchParams.get("freshMins") ?? "15");
  const FRESH_MS = freshMins * 60_000;
  const now = Date.now();

  // ✅ Accept common moneyline aliases
  const markets = await prisma.market.findMany({
    where: {
      type: { in: ["ML", "H2H", "h2h", "moneyline", "Moneyline"] },
    },
    include: {
      odds: { include: { sportsbook: true } },
      event: true,
    },
  });

  const results: Opportunity[] = [];

  for (const m of markets) {
    // Only keep fresh odds rows
    const A = m.odds.filter(
      (o) => isOutcomeA(o.outcome) && now - new Date(o.lastSeenAt).getTime() <= FRESH_MS
    );
    const B = m.odds.filter(
      (o) => isOutcomeB(o.outcome) && now - new Date(o.lastSeenAt).getTime() <= FRESH_MS
    );

    for (const ao of A) {
      for (const bo of B) {
        // Different books only
        if (ao.sportsbookId === bo.sportsbookId) continue;

        const roi = twoWayArbROI(ao.decimal, bo.decimal);
        if (roi <= 0 || roi < minRoi) continue;

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
