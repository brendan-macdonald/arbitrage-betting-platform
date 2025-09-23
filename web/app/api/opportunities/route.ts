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
  // Get all available bookmakers from DB for UI dropdown
  const allBooks = await prisma.sportsbook.findMany({ select: { name: true } });
  const allBookmakers = allBooks.map(b => b.name).sort();
  const url = new URL(request.url);
  const sports = parseCommaList(url.searchParams.get("sports"));
  const minRoi = parseNum(url.searchParams.get("minRoi"), 1.0) / 100; // percent to decimal
  const rawFreshMins = url.searchParams.get("freshMins");
  let freshMins = parseNum(rawFreshMins, 10080);
  if (freshMins < 1) freshMins = 10080; // enforce minimum freshness window
  // Accept both 'bookmakers' and legacy 'books' param
  const booksCsv = url.searchParams.get("books")?.trim() || "";
  const bookmakersCsv = url.searchParams.get("bookmakers")?.trim() || "";
  const bookWhitelist: string[] = (bookmakersCsv || booksCsv)
    ? (bookmakersCsv || booksCsv).split(",").map((b: string) => b.trim().toLowerCase()).filter(Boolean)
    : [];
  const markets: string[] = parseCommaList(url.searchParams.get("markets"));
  const marketTypes: string[] = markets.length ? markets.map((m: string) => m.toLowerCase() === "h2h" ? "ML" : m) : ["ML"];
  const FRESH_MS = freshMins * 60_000;
  const now = Date.now();

  // DEMO MODE LOGIC
  const forceDemo = url.searchParams.get("demo") === "1";
  const isDemoEnv = process.env.NEXT_PUBLIC_DEMO === "1";
  const useDemo = forceDemo || isDemoEnv;

  if (useDemo) {
    try {
      const mockPath = path.join(process.cwd(), "app/data/mock-arbs.json");
      const mockData = await fs.readFile(mockPath, "utf-8");
      let mock = JSON.parse(mockData);
      interface MockOpp {
        sport?: string;
        roi?: number;
        legs?: { book: string }[];
      }
      mock = mock.filter((opp: MockOpp) => {
        // Filter by sports
        if (sports.length && !sports.includes(String(opp.sport))) return false;
        // Filter by markets (always "ML" for demo)
        if (marketTypes.length && !marketTypes.includes("ML")) return false;
        // Filter by minRoi
        if (typeof opp.roi === "number" && opp.roi < minRoi) return false;
        return true;
      });
      // For demo, return all unique bookmakers in filtered mock data
      const demoBookmakers = Array.from(new Set(
        mock.flatMap((opp: { legs?: { book: string }[] }) => (opp.legs?.map((l) => l.book) ?? []))
      )).sort();
      return NextResponse.json({
        opportunities: mock,
        summary: {
          sports,
          markets: marketTypes,
          minRoi,
          count: mock.length,
          demo: true,
        },
        bookmakers: demoBookmakers,
      });
    } catch {
      const fallbackMarkets = Array.isArray(marketTypes) && marketTypes.length ? marketTypes : ["ML"];
      return NextResponse.json({ opportunities: [], summary: { sports, markets: fallbackMarkets, minRoi, count: 0, demo: true } }, { status: 200 });
    }
  }

  // Normal mode: fetch events from DB
  // Only ML markets for now
  const marketTypeList = ["ML"];
  // Build where clause for event filtering
  const eventWhere: Record<string, unknown> = {};
  if (sports.length) {
    eventWhere.sport = { in: sports };
  }
  // Time window: only fetch events starting soon
  const since = new Date(Date.now() - FRESH_MS);
  eventWhere.startsAt = { gte: since };

  // Fetch events with ML markets and odds in one query
  const events = await prisma.event.findMany({
    where: eventWhere,
    include: {
      markets: {
        where: { type: { in: marketTypeList } },
        include: {
          odds: { include: { sportsbook: true } },
        },
      },
    },
    orderBy: { startsAt: "desc" },
    take: 100,
  });
  const totalEventsFetched = events.length;
  let totalEventsConsidered = 0;
  const results: Array<Record<string, unknown>> = [];
  for (const ev of events) {
    for (const m of ev.markets) {
      totalEventsConsidered++;
      console.log(`Event ${ev.id} Market ${m.id}: odds count = ${m.odds.length}`);
      let bestA = null, bestB = null;
      for (const o of m.odds) {
        const oddsTime = new Date(o.lastSeenAt).getTime();
        const ageMs = now - oddsTime;
        const ageMin = ageMs / 60000;
        console.log(`    Odds ${o.id} (${o.outcome}) from ${o.sportsbook.name}: lastSeenAt=${o.lastSeenAt}, oddsTime=${oddsTime}, ageMs=${ageMs}, ageMin=${ageMin}`);
        if (ageMs > FRESH_MS) {
          console.log(`      Skipping odds: too old (ageMin=${ageMin}, FRESH_MS=${FRESH_MS/60000} min)`);
          continue;
        }
        if (bookWhitelist.length && !bookWhitelist.includes(o.sportsbook.name.toLowerCase())) {
          console.log(`      Skipping odds: not in whitelist`);
          continue;
        }
        if (o.outcome === "A" && (!bestA || o.decimal > bestA.decimal)) bestA = o;
        if (o.outcome === "B" && (!bestB || o.decimal > bestB.decimal)) bestB = o;
      }
      if (!bestA || !bestB) {
        console.log(`    Skipping market: missing bestA or bestB`);
        continue;
      }
      if (bestA.sportsbookId === bestB.sportsbookId) {
        console.log(`    Skipping market: bestA and bestB from same sportsbook (${bestA.sportsbook.name})`);
        continue;
      }
      const roi = roiOnStake(bestA.decimal, bestB.decimal);
      console.log(`    Market: bestA=${bestA.decimal} (${bestA.sportsbook.name}), bestB=${bestB.decimal} (${bestB.sportsbook.name}), ROI=${roi}`);
      if (roi < minRoi) {
        console.log(`    Skipping market: ROI ${roi} < minRoi ${minRoi}`);
        continue;
      }
      const legs = [
        { book: bestA.sportsbook.name, outcome: "A", dec: bestA.decimal },
        { book: bestB.sportsbook.name, outcome: "B", dec: bestB.decimal },
      ];
      results.push({
        id: `${m.id}-${bestA.sportsbookId}-${bestB.sportsbookId}`,
        sport: ev.sport,
        league: ev.league ?? ev.sport,
        startsAt: ev.startsAt.toISOString(),
        teamA: ev.teamA,
        teamB: ev.teamB,
        roi,
        legs,
      });
    }
  }
  results.sort((x, y) => y.roi - x.roi);
  return NextResponse.json({
    opportunities: results,
    summary: {
      sports,
      markets: marketTypeList,
      minRoi,
      count: results.length,
      totalEventsFetched,
      totalEventsConsidered,
      returned: results.length,
      demo: false,
    },
    bookmakers: allBookmakers,
  });
}
