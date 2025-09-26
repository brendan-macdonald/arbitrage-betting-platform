/**
 * ingest.ts
 * - Takes normalized events (provider-agnostic shape)
 * - Ensures Event + Market("ML") + Sportsbook exist
 * - Upserts odds rows (unique by (marketId, sportsbookId, outcome))
 * - NEW: Skips DB writes when the event's best prices haven't changed (hash guard)
 *
 * Why this layer?
 * - Keeps database writes separate from "where data came from".
 * - If you change providers or add more, you don't touch DB logic.
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
async function getOrCreateEventAndMarket(e: NormalizedEvent) {
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
  lines: Array<{ book: string; outcome: "A" | "B" | "OVER" | "UNDER"; decimal: number; line?: number; providerUpdatedAt?: string }>
) {
  for (const line of lines) {
    // Ensure sportsbook exists
    const book = await prisma.sportsbook.upsert({
      where: { name: line.book },
      update: {},
      create: { name: line.book },
    });

    // Prepare providerUpdatedAt value if present
    const providerUpdatedAt = line.providerUpdatedAt ? new Date(line.providerUpdatedAt) : undefined;

    // Use correct upsert key for ML/H2H (line is null) vs. spreads/totals (line is number)
    if (line.line === undefined || line.line === null) {
      // ML/H2H odds
      await prisma.odds.upsert({
        where: {
          marketId_sportsbookId_outcome: {
            marketId,
            sportsbookId: book.id,
            outcome: line.outcome,
          },
        },
        update: {
          decimal: line.decimal,
          lastSeenAt: new Date(),
          ...(providerUpdatedAt !== undefined ? { providerUpdatedAt } : {}),
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
      // Spreads/totals odds
      await prisma.odds.upsert({
        where: {
          marketId_sportsbookId_outcome_line: {
            marketId,
            sportsbookId: book.id,
            outcome: line.outcome,
            line: line.line,
          },
        },
        update: {
          decimal: line.decimal,
          lastSeenAt: new Date(),
          ...(providerUpdatedAt !== undefined ? { providerUpdatedAt } : {}),
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
  // If you later store a provider id, you can add it here for even more stability.
  return `${e.teamA}@${e.teamB}:${e.startsAt}:${e.league}:${e.sport}:${marketType}`;
}

/** Hash only the *best* A and *best* B decimal prices (fast + robust) */
function computeBestPriceHash(e: NormalizedEvent): string {
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

    // Write/update event, market, and odds
    const { market } = await getOrCreateEventAndMarket(ev);
    await upsertOddsBatch(market.id, ev.lines);

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
    oddsWritten += ev.lines.length;
  }

  return { eventsTouched, oddsWritten };
}
