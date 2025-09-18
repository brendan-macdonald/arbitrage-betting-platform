/**
 * Seed script: inserts:
 * - 2 sportsbooks
 * - 1 event with 1 Moneyline market
 * - Odds that GUARANTEE arbitrage (2.10 / 2.10) so the UI shows a card
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 1) Ensure sportsbooks exist (createMany is idempotent with skipDuplicates)
  await prisma.sportsbook.createMany({
    data: [{ name: "FanDuel" }, { name: "DraftKings" }],
    skipDuplicates: true,
  });

  // 2) Create one event with a Moneyline market ("ML")
  const ev = await prisma.event.create({
    data: {
      sport: "NBA",
      league: "NBA",
      startsAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      teamA: "BOS",
      teamB: "NYK",
      markets: {
        create: [{ type: "ML" }],
      },
    },
    include: { markets: true }, // we need the created market id
  });

  const market = ev.markets[0];

  // 3) Look up the two books to get their IDs
  const fd = await prisma.sportsbook.findUnique({ where: { name: "FanDuel" } });
  const dk = await prisma.sportsbook.findUnique({ where: { name: "DraftKings" } });
  if (!fd || !dk) throw new Error("books not found after createMany");

  // 4) Insert odds that guarantee arbitrage:
  // 2.10 on A and 2.10 on B → 1/2.1 + 1/2.1 = 0.952 < 1 → ~4.76% ROI
  await prisma.odds.createMany({
    data: [
      { marketId: market.id, sportsbookId: fd.id, outcome: "A", decimal: 2.10 },
      { marketId: market.id, sportsbookId: dk.id, outcome: "B", decimal: 2.10 },
    ],
    skipDuplicates: true,
  });

  console.log("Seed complete. Event:", ev.id, "Market:", market.id);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
