/**
 * ingest.ts
 * - Takes normalized events (provider-agnostic shape)
 * - Ensures Event + Market("ML") + Sportsbook exist
 * - Upserts odds rows (unique by (marketId, sportsbookId, outcome))
 *
 * Why this layer?
 * - Keeps database writes separate from "where data came from".
 * - If you change providers or add more, you don't touch DB logic.
 */

import { prisma } from "@/lib/db";
import type { NormalizedEvent } from "@/lib/oddsAdapters/theOddsApi";

/**
 * Find or create the Event + ML Market for a (league, teams, start time).
 * We use a simple heuristic match:
 *  - exact team names
 *  - same league
 *  - starts within a small time window (if you want to be fancy later)
 */
async function getOrCreateEventAndMarket(e: NormalizedEvent) {
  // Try to find an existing event first:
  let event = await prisma.event.findFirst({
    where: {
      league: e.league,
      teamA: e.teamA,
      teamB: e.teamB,
      startsAt: new Date(e.startsAt),
    },
    include: { markets: true },
  });

  if (!event) {
    // Create event + ML market
    event = await prisma.event.create({
      data: {
        sport: e.sport,
        league: e.league,
        startsAt: new Date(e.startsAt),
        teamA: e.teamA,
        teamB: e.teamB,
        markets: { create: [{ type: "ML" }] },
      },
      include: { markets: true },
    });
  }

  // Find ML market (create if somehow missing)
  let market = event.markets.find((m) => m.type === "ML");
  if (!market) {
    market = await prisma.market.create({
      data: { eventId: event.id, type: "ML" },
    });
  }

  return { event, market };
}

/**
 * Upsert a *batch* of odds lines into the DB for a given market.
 * For each (book, outcome) we either create or update the row.
 */
async function upsertOddsBatch(
  marketId: string,
  lines: Array<{ book: string; outcome: "A" | "B"; decimal: number }>
) {
  for (const line of lines) {
    // Ensure sportsbook exists
    const book = await prisma.sportsbook.upsert({
      where: { name: line.book },
      update: {},
      create: { name: line.book },
    });

    // Upsert odds for (market, book, outcome)
    await prisma.odds.upsert({
      where: {
        marketId_sportsbookId_outcome: {
          marketId,
          sportsbookId: book.id,
          outcome: line.outcome,
        },
      },
      update: { decimal: line.decimal, lastSeenAt: new Date() },
      create: {
        marketId,
        sportsbookId: book.id,
        outcome: line.outcome,
        decimal: line.decimal,
      },
    });
  }
}

/**
 * ingestNormalizedEvents
 * - The top-level function you'll call from an API route to save fresh odds.
 */
export async function ingestNormalizedEvents(events: NormalizedEvent[]) {
  let eventsTouched = 0;
  let oddsWritten = 0;

  for (const ev of events) {
    const { market } = await getOrCreateEventAndMarket(ev);
    await upsertOddsBatch(market.id, ev.lines);
    eventsTouched++;
    oddsWritten += ev.lines.length;
  }

  return { eventsTouched, oddsWritten };
}
