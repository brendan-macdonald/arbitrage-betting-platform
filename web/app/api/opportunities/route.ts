// In-memory cache for GET /api/opportunities
const CACHE_TTL_MS = 20_000;
const cache = new Map<string, { data: any; expiry: number }>();

function buildCacheKey(params: {
  sports: string[];
  markets: string[];
  books: string[];
  minRoi: number;
  limit?: number;
  offset?: number;
}) {
  return [
    params.sports.sort().join(","),
    params.markets.sort().join(","),
    params.books.sort().join(","),
    params.minRoi,
    params.limit ?? "",
    params.offset ?? ""
  ].join("|");
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findTwoWayArbs, MarketKind, ArbLeg } from "@/lib/arbitrage";
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
  // Skip cache if DEMO mode or ?cache=0
  const url = new URL(request.url);
  const skipCache = process.env.DEMO === '1' || url.searchParams.get("cache") === "0";

  // Parse filters (must match cache key logic)
  const sports = parseCommaList(url.searchParams.get("sports"));
  const markets = parseCommaList(url.searchParams.get("markets"));
  const booksCsv = url.searchParams.get("books")?.trim() || "";
  const bookmakersCsv = url.searchParams.get("bookmakers")?.trim() || "";
  const bookWhitelist: string[] = (bookmakersCsv || booksCsv)
    ? (bookmakersCsv || booksCsv).split(",").map((b: string) => b.trim().toLowerCase()).filter(Boolean)
    : [];
  const minRoi = parseNum(url.searchParams.get("minRoi"), 0.01);
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 25;
  const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;

  const cacheKey = buildCacheKey({ sports, markets, books: bookWhitelist, minRoi, limit, offset });
  if (!skipCache) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data);
    }
  }
  // Parse filters
  const allBooks = await prisma.sportsbook.findMany({ select: { name: true } });
  const allBookmakers = allBooks.map(b => b.name).sort();
  const url = new URL(request.url);
  const useDemo = url.searchParams.get("demo") === "1";
  // If minRoi is not provided, default to 0.0001 (0.01%) in demo mode, else 0.01 (1%)
  const rawFreshMins = url.searchParams.get("freshMins");
  let freshMins = parseNum(rawFreshMins, 10080);
  if (freshMins < 1) freshMins = 10080;
  const marketTypes: MarketKind[] = markets.length
    ? markets.map((m: string) => {
        if (m.toLowerCase() === "h2h") return "ML";
        if (m.toLowerCase() === "spread") return "SPREAD";
        if (m.toLowerCase() === "totals") return "TOTAL";
        return m.toUpperCase();
      }) as MarketKind[]
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
      const resp = {
        opportunities: mock,
        summary: {
          sports,
          markets: marketTypes,
          minRoi,
          count: mock.length,
          demo: true,
        },
        bookmakers: demoBookmakers,
      };
      if (!skipCache) cache.set(cacheKey, { data: resp, expiry: Date.now() + CACHE_TTL_MS });
      return NextResponse.json(resp);
    } catch (err) {
      console.error("[DEMO MODE] Error loading mock data:", err);
      const fallbackMarkets = Array.isArray(marketTypes) && marketTypes.length ? marketTypes : ["ML"];
  const resp = { opportunities: [], summary: { sports, markets: fallbackMarkets, minRoi, count: 0, demo: true } };
  if (!skipCache) cache.set(cacheKey, { data: resp, expiry: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(resp, { status: 200 });
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
  // ...existing code...
  const results: Array<Record<string, unknown>> = [];
  const uniqueBooks = new Set<string>();
  for (const ev of events) {
    // Gather all odds for this event, flattening across all markets
    let legs: ArbLeg[] = [];
    for (const m of ev.markets) {
  // ...existing code...
      // Filter odds by freshness and book whitelist
      const odds = m.odds.filter((o: any) => {
        const ageMs = now - new Date(o.lastSeenAt).getTime();
        if (ageMs > FRESH_MS) return false;
        if (bookWhitelist.length && !bookWhitelist.includes(o.sportsbook.name.toLowerCase())) return false;
        return true;
      });
      odds.forEach((o: any) => uniqueBooks.add(o.sportsbook.name));
      // Only include odds for allowed market types
      if (!marketTypes.includes(m.type)) continue;
      for (const o of odds) {
        legs.push({
          book: o.sportsbook.name,
          market: m.type,
          outcome: o.outcome,
          decimal: o.decimal,
          line: m.type === 'ML' ? undefined : (o.line == null ? undefined : o.line),
        });
      }
    }
    // Only keep legs for allowed market types
    legs = legs.filter(l => marketTypes.includes(l.market));
    // Find arbs for this event
    const arbs = findTwoWayArbs(legs).filter(a => a.roi >= minRoi);
    for (const arb of arbs) {
      results.push({
        market: arb.market,
        id: `${ev.id}-${arb.market}${arb.line !== undefined ? '-' + arb.line : ''}`,
        sport: ev.sport,
        league: ev.league ?? ev.sport,
        startsAt: ev.startsAt.toISOString(),
        teamA: ev.teamA,
        teamB: ev.teamB,
        line: arb.line,
        roi: Number(arb.roi.toFixed(3)),
        a: arb.a,
        b: arb.b,
      });
    }
  }
  results.sort((x, y) => (Number(y.roi) || 0) - (Number(x.roi) || 0));
  const total = results.length;
  const paged = results.slice(offset, offset + limit);
  // Summary counts by market kind (for all results, not just paged)
  const byMarket = {
    ML: results.filter(r => r.market === 'ML').length,
    SPREAD: results.filter(r => r.market === 'SPREAD').length,
    TOTAL: results.filter(r => r.market === 'TOTAL').length,
  };
  const resp = {
    opportunities: paged,
    summary: {
      total, // total opportunities found (before pagination)
      returned: paged.length, // number returned in this page
      limit,
      offset,
      byMarket,
      sports,
      markets: marketTypes,
      minRoi,
      uniqueBooks: Array.from(uniqueBooks).sort(),
      demo: false,
    },
    bookmakers: allBookmakers,
  };
  if (!skipCache) cache.set(cacheKey, { data: resp, expiry: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(resp);
}
