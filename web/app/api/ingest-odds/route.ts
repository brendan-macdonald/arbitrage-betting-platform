import type { MarketKind } from "@/lib/arbitrage";
// Ingest odds for a single sport/region/market. Fallback to env defaults if params missing.

import { NextResponse } from "next/server";
import { fetchTheOddsApi } from "@/lib/oddsAdapters/theOddsApi";
import { ingestNormalizedEvents } from "@/lib/ingest";

export async function POST(request: Request) {
  try {
    // Query params override env defaults
    const url = new URL(request.url);
    const sport = url.searchParams.get("sport") ?? undefined; // e.g., "americanfootball_ncaaf"
    const region = url.searchParams.get("region") ?? undefined; // e.g., "us"
    const market = url.searchParams.get("market") ?? undefined; // e.g., "h2h"
    const markets: MarketKind[] | undefined = url.searchParams
      .get("markets")
      ?.split(",")
      .filter(Boolean) as MarketKind[] | undefined;
    const bookmakers =
      url.searchParams.get("bookmakers")?.split(",").filter(Boolean) ??
      (process.env.ODDS_API_BOOKMAKERS
        ? process.env.ODDS_API_BOOKMAKERS.split(",")
            .map((b) => b.trim())
            .filter(Boolean)
        : undefined);

    // Fetch from provider, fallback to env if undefined
    const events = await fetchTheOddsApi({
      sport,
      region,
      markets: markets ?? (market ? [market as MarketKind] : undefined),
      bookmakers,
    });

    // Upsert into DB (idempotent)
    const { eventsTouched, oddsWritten } = await ingestNormalizedEvents(events);

    return NextResponse.json({
      ok: true,
      sport: sport ?? process.env.ODDS_API_SPORT,
      eventsTouched,
      oddsWritten,
      markets: markets ?? (market ? [market] : undefined),
      bookmakers,
    });
  } catch (err) {
    // Log error for ops/debug
    console.error("ingest-odds error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
