/**
 * POST /api/ingest-odds?sport=americanfootball_ncaaf&region=us&market=h2h
 * - If no query params are provided, it falls back to env defaults.
 * - This lets you call multiple sports without code changes.
 */

import { NextResponse } from "next/server";
import { fetchTheOddsApi } from "@/lib/oddsAdapters/theOddsApi";
import { ingestNormalizedEvents } from "@/lib/ingest";

export async function POST(request: Request) {
  try {
    // 1) Read query params from the request URL (App Router style)
    const url = new URL(request.url);
    const sport  = url.searchParams.get("sport")  ?? undefined; // e.g., "americanfootball_ncaaf"
    const region = url.searchParams.get("region") ?? undefined; // e.g., "us"
    const market = url.searchParams.get("market") ?? undefined; // e.g., "h2h"

    // 2) Fetch from provider with overrides (falls back to env if undefined)
    const events = await fetchTheOddsApi({ sport, region, market });

    // 3) Upsert into DB (idempotent)
    const { eventsTouched, oddsWritten } = await ingestNormalizedEvents(events);

    return NextResponse.json({ ok: true, sport: sport ?? process.env.ODDS_API_SPORT, eventsTouched, oddsWritten });
  } catch (err) {
    console.error("ingest-odds error:", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
