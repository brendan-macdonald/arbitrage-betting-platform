import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function impliedSum(a: number, b: number) {
  return 1 / a + 1 / b; // < 1 => true arb
}

export async function GET() {
  const markets = await prisma.market.findMany({
    where: { type: "ML" }, // your debug showed ML + outcomes A/B
    include: {
      event: true,
      odds: { include: { sportsbook: true } },
    },
    take: 150,
  });

  const rows: Array<{
    marketId: string;
    match: string;
    best?: {
      sum: number;
      roiOnStake: number;  // may be negative if sum > 1
      a: { book: string; dec: number };
      b: { book: string; dec: number };
    };
  }> = [];

  for (const m of markets) {
    const A = m.odds.filter(o => o.outcome === "A");
    const B = m.odds.filter(o => o.outcome === "B");

    let best: {
      sum: number;
      roiOnStake: number;
      a: { book: string; dec: number };
      b: { book: string; dec: number };
    } | null = null;
    for (const ao of A) {
      for (const bo of B) {
        if (ao.sportsbookId === bo.sportsbookId) continue; // cross-book only
        const sum = impliedSum(ao.decimal, bo.decimal);
        const roiOnStake = (1 - sum) / sum; // negative if sum > 1
        if (!best || sum < best.sum) {
          best = {
            sum,
            roiOnStake,
            a: { book: ao.sportsbook.name, dec: ao.decimal },
            b: { book: bo.sportsbook.name, dec: bo.decimal },
          };
        }
      }
    }

    rows.push({
      marketId: m.id,
      match: `${m.event.teamA} vs ${m.event.teamB}`,
      best: best ?? undefined,
    });
  }

  rows.sort((x, y) => {
    const sx = x.best ? x.best.sum : 99;
    const sy = y.best ? y.best.sum : 99;
    return sx - sy;
  });

  return NextResponse.json(rows.slice(0, 25));
}
