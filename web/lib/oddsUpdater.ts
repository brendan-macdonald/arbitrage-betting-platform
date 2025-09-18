/**
 * This file pretends to be a scraper:
 * - It *reads* current markets + odds from the DB
 * - It *nudges* the decimal odds up/down a bit (random drift)
 * - For the *first* market, it enforces a guaranteed arbitrage so your UI always has a demo
 *
 * Why not real scraping yet?
 * - We want to prove the refresh loop first.
 * - Later you can replace the "drift" with real scraping/API results and reuse the upsert path.
 */

import { prisma } from "@/lib/db";

/**
 * Clamp a number between min and max.
 * Useful to keep odds within realistic bounds while we "drift" them.
 */
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Random drift helper:
 * - Takes a decimal odd (e.g., 2.05) and returns a slightly changed value (e.g., 2.08)
 * - Keeps the new odd within [1.6, 2.6] for demo stability
 */
function drift(dec: number) {
  // random step ~ [-0.08, +0.08]
  const step = (Math.random() - 0.5) * 0.16;
  return clamp(Number((dec + step).toFixed(2)), 1.6, 2.6);
}

/**
 * applyMockOddsDrift
 * - Reads all ML markets and their odds
 * - For the *first* market, force an arbitrage pair (2.10 / 2.10)
 * - For all markets, apply a small drift to existing odds
 *
 * NOTE on schema:
 * - Our Odds table has a UNIQUE (marketId, sportsbookId, outcome), so "update" is enough.
 * - If you ever add new rows for new books/outcomes, you'd switch to `upsert`.
 */
export async function applyMockOddsDrift(): Promise<{ updated: number }> {
  // 1) load ML markets with odds & sportsbook in a single query
  const markets = await prisma.market.findMany({
    where: { type: "ML" },
    include: {
      event: true,
      odds: { include: { sportsbook: true } },
    },
    orderBy: { id: "asc" }, // deterministic "first market"
  });

  let updates = 0;

  for (let mi = 0; mi < markets.length; mi++) {
    const m = markets[mi];

    // split odds into side A and side B
    const a = m.odds.filter((o) => o.outcome === "A");
    const b = m.odds.filter((o) => o.outcome === "B");

    // 2) For the very first market, *force* arbitrage on one A/B pair
    //    So your home page always has a visible card.
    if (mi === 0 && a.length > 0 && b.length > 0) {
      // pick the first A and first B line and set both to 2.10
      const aLine = a[0];
      const bLine = b[0];

      await prisma.odds.update({
        where: { id: aLine.id },
        data: { decimal: 2.10, lastSeenAt: new Date() },
      });
      await prisma.odds.update({
        where: { id: bLine.id },
        data: { decimal: 2.10, lastSeenAt: new Date() },
      });
      updates += 2;
    }

    // 3) For *all* existing odds, apply a small random drift (so the UI changes)
    for (const o of m.odds) {
      const next = drift(o.decimal);
      if (next === o.decimal) continue;

      await prisma.odds.update({
        where: { id: o.id },
        data: { decimal: next, lastSeenAt: new Date() },
      });
      updates++;
    }
  }

  return { updated: updates };
}
