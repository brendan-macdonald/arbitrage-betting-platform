/**
 * ingest.ts
 * - Takes normalized events (provider-agnostic shape)
 * - Ensures Event + Market("ML") + Sportsbook exist
 * - Upserts odds rows (unique by (marketId, sportsbookId, outcome))
 * - Skips DB writes when the event's best prices haven't changed (hash guard)
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { NormalizedEvent } from "@/lib/oddsAdapters/theOddsApi";

/**
 * Find or create the Event + ML Market for a (league, teams, start time).
 * We use a simple heuristic match:
 *  - exact team names
 *  - same league & sport
 *  - exact start time (you can widen to a window if needed)
 */
async function getOrCreateEventAndMarket(
  e: NormalizedEvent,
  marketType: "ML" | "SPREAD" | "TOTAL"
) {
  // Finds or creates event/market for given event and market type

  // Try to find an existing event first:
  let event = await prisma.event.findFirst({
    where: {
      sport: e.sport,
      league: e.league,
      teamA: e.teamA,
      teamB: e.teamB,
      startsAt: new Date(e.startsAt),
    },
    include: { markets: true },
  });

  if (!event) {
    // Create event + market of the correct type
    event = await prisma.event.create({
      data: {
        sport: e.sport,
        league: e.league,
        startsAt: new Date(e.startsAt),
        teamA: e.teamA,
        teamB: e.teamB,
        markets: { create: [{ type: marketType }] },
      },
      include: { markets: true },
    });
  }

  // Find market of the correct type (create if somehow missing)
  let market = event.markets.find((m) => m.type === marketType);
  if (!market) {
    market = await prisma.market.create({
      data: { eventId: event.id, type: marketType },
    });
  }

  return { event, market };
}

/**
 * Upsert a *batch* of odds lines into the DB for a given market.
 * For each (book, outcome) we either create or update the row.
 */
type UpsertLine = {
  book: string;
  market: "ML" | "SPREAD" | "TOTAL";
  outcome: "A" | "B" | "OVER" | "UNDER";
  decimal: number;
  line?: number;
  providerUpdatedAt?: string;
};

async function upsertOddsBatch(marketId: string, lines: UpsertLine[]) {
  // Upserts batch of odds lines for a market, ensures sportsbook exists

  for (const line of lines) {
    // Ensure sportsbook exists
    const book = await prisma.sportsbook.upsert({
      where: { name: line.book },
      update: {},
      create: { name: line.book },
    });

    const providerUpdatedAt = line.providerUpdatedAt
      ? new Date(line.providerUpdatedAt)
      : undefined;

    // ML: unique on (marketId, sportsbookId, outcome) where line is null
    // SPREAD/TOTAL: unique on (marketId, sportsbookId, outcome, line)
    if (line.market === "ML") {
      // Only update if decimal or providerUpdatedAt changed; always bump lastSeenAt
      await prisma.odds.upsert({
        where: {
          marketId_sportsbookId_outcome: {
            marketId,
            sportsbookId: book.id,
            outcome: line.outcome,
          },
        },
        update: {
          ...(providerUpdatedAt !== undefined ? { providerUpdatedAt } : {}),
          decimal: line.decimal,
          lastSeenAt: new Date(),
        },
        create: {
          marketId,
          sportsbookId: book.id,
          outcome: line.outcome,
          decimal: line.decimal,
          line: null,
          ...(providerUpdatedAt !== undefined ? { providerUpdatedAt } : {}),
        },
      });
    } else {
      // SPREAD/TOTAL
      await prisma.odds.upsert({
        where: {
          marketId_sportsbookId_outcome_line: {
            marketId,
            sportsbookId: book.id,
            outcome: line.outcome,
            line: line.line!,
          },
        },
        update: {
          ...(providerUpdatedAt !== undefined ? { providerUpdatedAt } : {}),
          decimal: line.decimal,
          line: line.line,
          lastSeenAt: new Date(),
        },
        create: {
          marketId,
          sportsbookId: book.id,
          outcome: line.outcome,
          decimal: line.decimal,
          line: line.line,
          ...(providerUpdatedAt !== undefined ? { providerUpdatedAt } : {}),
        },
      });
    }
  }
}

/** ---------- NEW: odds fingerprint helpers (hash guard) ---------- */

/** Stable key for this event’s ML snapshot (does not depend on books present) */
function fingerprintKey(e: NormalizedEvent, marketType: "ML" = "ML") {
  // Stable key for event's ML snapshot

  // If you later store a provider id, you can add it here for even more stability.
  return `${e.teamA}@${e.teamB}:${e.startsAt}:${e.league}:${e.sport}:${marketType}`;
}

/** Hash only the *best* A and *best* B decimal prices (fast + robust) */
function computeBestPriceHash(e: NormalizedEvent): string {
  // Hashes best A/B prices for event

  let bestA = 0;
  let bestB = 0;
  for (const line of e.lines ?? []) {
    const price = Number(line.decimal);
    if (!isFinite(price) || price <= 1) continue;
    if (line.outcome === "A") bestA = Math.max(bestA, price);
    if (line.outcome === "B") bestB = Math.max(bestB, price);
  }
  const s = `A:${bestA}|B:${bestB}`;
  return createHash("sha1").update(s).digest("hex");
}

/**
 * ingestNormalizedEvents
 * - Top-level writer with a "no-change" short-circuit:
 *   1) Compute event fingerprint (key + best-price hash)
 *   2) If hash unchanged in OddsFingerprint → skip DB writes
 *   3) Else write odds and upsert new fingerprint
 */
export async function ingestNormalizedEvents(events: NormalizedEvent[]) {
  // Top-level ingest: skips DB writes if fingerprint unchanged

  let eventsTouched = 0;
  let oddsWritten = 0;

  if (!Array.isArray(events) || events.length === 0) {
    return { eventsTouched, oddsWritten };
  }

  // Prepare fingerprint lookups to avoid N roundtrips when possible
  const keys = events.map((e) => fingerprintKey(e));
  let existingMap = new Map<string, string>();
  try {
    const existing = await prisma.oddsFingerprint.findMany({
      where: { key: { in: keys } },
      select: { key: true, hash: true },
    });
    existingMap = new Map(existing.map((r) => [r.key, r.hash]));
  } catch {
    existingMap = new Map();
  }

  for (const ev of events) {
    const key = fingerprintKey(ev);
    const newHash = computeBestPriceHash(ev);
    const prevHash = existingMap.get(key);

    // If best prices haven’t changed, skip DB writes for this event
    if (prevHash && prevHash === newHash) {
      continue;
    }

    // Group lines by market type
    const linesByMarket: Record<"ML" | "SPREAD" | "TOTAL", UpsertLine[]> = {
      ML: [],
      SPREAD: [],
      TOTAL: [],
    };
    for (const line of ev.lines) {
      linesByMarket[line.market].push(line);
    }

    for (const marketType of ["ML", "SPREAD", "TOTAL"] as const) {
      if (linesByMarket[marketType].length === 0) continue;
      const { market } = await getOrCreateEventAndMarket(ev, marketType);
      await upsertOddsBatch(market.id, linesByMarket[marketType]);
      oddsWritten += linesByMarket[marketType].length;
    }

    // Upsert fingerprint (ignore errors so a missing table won’t block ingest)
    try {
      await prisma.oddsFingerprint.upsert({
        where: { key },
        create: { key, hash: newHash },
        update: { hash: newHash },
      });
    } catch {
      /* noop */
    }

    eventsTouched++;
  }

  return { eventsTouched, oddsWritten };
}
