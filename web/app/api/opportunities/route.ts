import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findMlArb, findSpreadArbs, findTotalArbs, stakeSplit } from "@/lib/arbitrage";
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
  // Parse filters
  const allBooks = await prisma.sportsbook.findMany({ select: { name: true } });
  const allBookmakers = allBooks.map(b => b.name).sort();
  const url = new URL(request.url);
  const sports = parseCommaList(url.searchParams.get("sports"));
  const useDemo = url.searchParams.get("demo") === "1";
  // If minRoi is not provided, default to 0.0001 (0.01%) in demo mode, else 0.01 (1%)
  const minRoi = parseNum(url.searchParams.get("minRoi"), useDemo ? 0.0001 : 0.01);
  const rawFreshMins = url.searchParams.get("freshMins");
  let freshMins = parseNum(rawFreshMins, 10080);
  if (freshMins < 1) freshMins = 10080;
  const booksCsv = url.searchParams.get("books")?.trim() || "";
  const bookmakersCsv = url.searchParams.get("bookmakers")?.trim() || "";
  const bookWhitelist: string[] = (bookmakersCsv || booksCsv)
    ? (bookmakersCsv || booksCsv).split(",").map((b: string) => b.trim().toLowerCase()).filter(Boolean)
    : [];
  const markets: string[] = parseCommaList(url.searchParams.get("markets"));
  const marketTypes: string[] = markets.length
    ? markets.map((m: string) => {
        if (m.toLowerCase() === "h2h") return "ML";
        if (m.toLowerCase() === "spread") return "SPREAD";
        if (m.toLowerCase() === "totals") return "TOTAL";
        return m.toUpperCase();
      })
    : ["ML"];
  const FRESH_MS = freshMins * 60_000;
  const now = Date.now();

  // DEMO MODE LOGIC
  // ...existing code...
  if (useDemo) {
    try {
      const mockPath = path.join(process.cwd(), "app/data/mock-arbs.json");
      const mockData = await fs.readFile(mockPath, "utf-8");
      let mock = JSON.parse(mockData);
      const beforeCount = mock.length;
      mock = mock.filter((opp: any) => {
        if (sports.length && !sports.includes(String(opp.sport))) return false;
        if (marketTypes.length && opp.market && !marketTypes.includes(opp.market)) return false;
        if (typeof opp.roi === "number" && opp.roi < minRoi) return false;
        if (bookWhitelist.length && !opp.legs?.some((l: any) => bookWhitelist.includes(l.book.toLowerCase()))) return false;
        return true;
      }).map((opp: any) => ({
        ...opp,
        roiPct: typeof opp.roi === 'number' ? opp.roi * 100 : undefined
      }));
      const afterCount = mock.length;
      // Debug logging
      console.log("[DEMO MODE] Filters:", { sports, marketTypes, minRoi, bookWhitelist });
      console.log(`[DEMO MODE] Mock opportunities before filter: ${beforeCount}, after filter: ${afterCount}`);
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
    } catch (err) {
      console.error("[DEMO MODE] Error loading mock data:", err);
      const fallbackMarkets = Array.isArray(marketTypes) && marketTypes.length ? marketTypes : ["ML"];
      return NextResponse.json({ opportunities: [], summary: { sports, markets: fallbackMarkets, minRoi, count: 0, demo: true } }, { status: 200 });
    }
  }

  // Query events in time window, include all market types
  const eventWhere: Record<string, unknown> = {};
  if (sports.length) eventWhere.sport = { in: sports };
  const since = new Date(Date.now() - FRESH_MS);
  eventWhere.startsAt = { gte: since };
  const events = await prisma.event.findMany({
    where: eventWhere,
    include: {
      markets: {
        where: { type: { in: marketTypes } },
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
  const uniqueBooks = new Set<string>();
  for (const ev of events) {
    for (const m of ev.markets) {
      totalEventsConsidered++;
      // Filter odds by freshness and book whitelist
      const odds = m.odds.filter((o: any) => {
        const ageMs = now - new Date(o.lastSeenAt).getTime();
        if (ageMs > FRESH_MS) return false;
        if (bookWhitelist.length && !bookWhitelist.includes(o.sportsbook.name.toLowerCase())) return false;
        return true;
      });
      odds.forEach((o: any) => uniqueBooks.add(o.sportsbook.name));
      // ML
      if (m.type === 'ML' && marketTypes.includes('ML')) {
        const lines = odds.map((o: any) => ({ book: o.sportsbook.name, outcome: o.outcome, decimal: o.decimal }));
        // Debug log: print lines for ML market
        console.log(`[ARBITRAGE DEBUG] ML lines for event ${ev.teamA} vs ${ev.teamB}:`, lines);
        const arb = findMlArb(lines);
        if (arb) {
          console.log(`[ARBITRAGE DEBUG] ML ROI calculation:`, {
            bestA: arb.legs[0]?.dec,
            bestB: arb.legs[1]?.dec,
            roi: arb.roi
          });
        }
        if (arb && arb.roi >= minRoi) {
          results.push({
            market: 'ML',
            id: `${m.id}-ML`,
            sport: ev.sport,
            league: ev.league ?? ev.sport,
            startsAt: ev.startsAt.toISOString(),
            teamA: ev.teamA,
            teamB: ev.teamB,
            roiPct: arb.roi,
            stake: stakeSplit(100, arb.legs[0].dec, arb.legs[1].dec),
            legs: arb.legs,
          });
        }
      }
      // SPREAD
      if (m.type === 'SPREAD' && marketTypes.includes('SPREAD')) {
        const lines = odds.map((o: any) => ({ book: o.sportsbook.name, market: 'SPREAD', outcome: o.outcome, decimal: o.decimal, line: o.line }));
        for (const arb of findSpreadArbs(lines)) {
          if (arb.roi >= minRoi) {
            results.push({
              market: 'SPREAD',
              id: `${m.id}-SPREAD-${arb.line}`,
              sport: ev.sport,
              league: ev.league ?? ev.sport,
              startsAt: ev.startsAt.toISOString(),
              teamA: ev.teamA,
              teamB: ev.teamB,
              line: arb.line,
              roiPct: arb.roi,
              stake: stakeSplit(100, arb.legs[0].dec, arb.legs[1].dec),
              legs: arb.legs,
            });
          }
        }
      }
      // TOTAL
      if (m.type === 'TOTAL' && marketTypes.includes('TOTAL')) {
        const lines = odds.map((o: any) => ({ book: o.sportsbook.name, market: 'TOTAL', outcome: o.outcome, decimal: o.decimal, line: o.line }));
        for (const arb of findTotalArbs(lines)) {
          if (arb.roi >= minRoi) {
            results.push({
              market: 'TOTAL',
              id: `${m.id}-TOTAL-${arb.line}`,
              sport: ev.sport,
              league: ev.league ?? ev.sport,
              startsAt: ev.startsAt.toISOString(),
              teamA: ev.teamA,
              teamB: ev.teamB,
              line: arb.line,
              roiPct: arb.roi,
              stake: stakeSplit(100, arb.legs[0].dec, arb.legs[1].dec),
              legs: arb.legs,
            });
          }
        }
      }
    }
  }
  results.sort((x, y) => (Number(y.roiPct) || 0) - (Number(x.roiPct) || 0));
  return NextResponse.json({
    opportunities: results,
    summary: {
      sports,
      markets: marketTypes,
      minRoi,
      count: results.length,
      totalEventsFetched,
      totalEventsConsidered,
      returned: results.length,
      uniqueBooks: Array.from(uniqueBooks).sort(),
      demo: false,
    },
    bookmakers: allBookmakers,
  });
}
