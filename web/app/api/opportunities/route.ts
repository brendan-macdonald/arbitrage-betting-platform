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
import fs from "fs/promises";
import path from "path";

function parseCommaList(val: string | null | undefined): string[] {
  if (!val) return [];
  return val.split(",").map(s => s.trim()).filter(Boolean);
}
function parseNum(val: string | null | undefined, def: number): number {
  const n = Number(val);
  return isFinite(n) ? n : def;
}
function roiOnStake(a: number, b: number) {
  const s = 1 / a + 1 / b;
  return (1 - s) / s;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Parse filters
  const sports = parseCommaList(url.searchParams.get("sports"));
  const markets = parseCommaList(url.searchParams.get("markets")).map(m => m.toLowerCase() === "h2h" ? "ML" : m);
  const minRoi = parseNum(url.searchParams.get("minRoi"), 1.0) / 100; // percent to decimal
  const freshMins = parseNum(url.searchParams.get("freshMins"), 1440);
  const booksCsv = url.searchParams.get("books")?.trim();
  const bookWhitelist = booksCsv ? booksCsv.split(",").map(b => b.trim().toLowerCase()).filter(Boolean) : null;
  const FRESH_MS = freshMins * 60_000;
  const now = Date.now();

  // DEMO MODE LOGIC
  const forceDemo = url.searchParams.get("demo") === "1";
  const isDemoEnv = process.env.NEXT_PUBLIC_DEMO === "1";
  let useDemo = forceDemo || isDemoEnv;

  try {
    if (!useDemo) {
      // Prisma query filters
      // Use object type for where to avoid 'any' lint error
      const where: object = {
        type: { in: markets.length ? markets : ["ML"] },
        ...(sports.length ? { event: { sport: { in: sports } } } : {}),
      };
      const marketsRes = await prisma.market.findMany({
        where,
        include: {
          event: true,
          odds: { include: { sportsbook: true } },
        },
        take: 100,
      });
      const results: Opportunity[] = [];
      for (const m of marketsRes) {
        // Best A/B odds (fresh, optional book filter)
        let bestA = null, bestB = null;
        for (const o of m.odds) {
          if (now - new Date(o.lastSeenAt).getTime() > FRESH_MS) continue;
          if (bookWhitelist && !bookWhitelist.includes(o.sportsbook.name.toLowerCase())) continue;
          if (o.outcome === "A" && (!bestA || o.decimal > bestA.decimal)) bestA = o;
          if (o.outcome === "B" && (!bestB || o.decimal > bestB.decimal)) bestB = o;
        }
        if (!bestA || !bestB) continue;
        if (bestA.sportsbookId === bestB.sportsbookId) continue;
        const roi = roiOnStake(bestA.decimal, bestB.decimal);
        if (roi < minRoi) continue;
        const legs: Leg[] = [
          { book: bestA.sportsbook.name, outcome: "A", dec: bestA.decimal },
          { book: bestB.sportsbook.name, outcome: "B", dec: bestB.decimal },
        ];
        results.push({
          id: `${m.id}-${bestA.sportsbookId}-${bestB.sportsbookId}`,
          sport: m.event.sport,
          league: m.event.league ?? m.event.sport,
          startsAt: m.event.startsAt.toISOString(),
          teamA: m.event.teamA,
          teamB: m.event.teamB,
          roi,
          legs,
        });
      }
      results.sort((x, y) => y.roi - x.roi);
      return NextResponse.json({
        opportunities: results,
        summary: {
          sports,
          markets: markets.length ? markets : ["ML"],
          minRoi,
          count: results.length,
        },
      });
    }
  } catch (err: unknown) {
    // Use unknown for error type, cast as needed
    const msg = typeof err === "object" && err && "message" in err ? String((err as { message?: unknown }).message) : String(err);
    if (
      msg.includes("401") ||
      msg.includes("402") ||
      msg.includes("OUT_OF_USAGE_CREDITS")
    ) {
      useDemo = true;
    } else {
      throw err;
    }
  }
  // DEMO MODE: Return filtered mock data
  try {
    const mockPath = path.join(process.cwd(), "app/data/mock-arbs.json");
    const mockData = await fs.readFile(mockPath, "utf-8");
    let mock = JSON.parse(mockData);
    // Apply filters to mock data
    const marketTypes = markets.length ? markets.map(m => m.toLowerCase() === "h2h" ? "ML" : m) : ["ML"];
    mock = mock.filter((opp: any) => {
      // Filter by sports
      if (sports.length && !sports.includes(opp.sport)) return false;
      // Filter by markets (always "ML" for demo)
      if (marketTypes.length && !marketTypes.includes("ML")) return false;
      // Filter by minRoi
      if (typeof opp.roi === "number" && opp.roi < minRoi) return false;
      return true;
    });
    return NextResponse.json({
      opportunities: mock,
      summary: {
        sports,
        markets: marketTypes,
        minRoi,
        count: mock.length,
        demo: true,
      },
    });
  } catch {
    return NextResponse.json({ opportunities: [], summary: { sports, markets: markets.length ? markets : ["ML"], minRoi, count: 0, demo: true } }, { status: 200 });
  }
}
