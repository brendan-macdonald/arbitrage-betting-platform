import { NextResponse } from "next/server";
import { fetchTheOddsApi } from "@/lib/oddsAdapters/theOddsApi";
import { ingestNormalizedEvents } from "@/lib/ingest";

import { SPORTS } from "@/lib/oddsAdapters/sports";
const REGIONS = ["us", "uk", "eu"];

export async function POST() {
  let totalEvents = 0;
  let totalOdds = 0;
  let errors: string[] = [];

  for (const sport of SPORTS) {
    for (const region of REGIONS) {
      try {
        const events = await fetchTheOddsApi({ sport, region, market: "h2h" });
        const { eventsTouched, oddsWritten } = await ingestNormalizedEvents(events);
        totalEvents += eventsTouched;
        totalOdds += oddsWritten;
      } catch (e: any) {
        errors.push(`${sport}/${region}: ${e.message}`);
      }
    }
  }

  return NextResponse.json({ ok: true, totalEvents, totalOdds, errors });
}
