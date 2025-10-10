/**
 * Seed script: inserts demo sportsbooks, event, market, and guaranteed arbitrage odds.
 * - Contract: Idempotent, ensures UI always shows a card.
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Ensure sportsbooks exist (idempotent)
  await prisma.sportsbook.createMany({
    data: [{ name: "FanDuel" }, { name: "DraftKings" }],
    skipDuplicates: true,
  });

  // Create one event with a Moneyline market
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

  // Look up the two books to get their IDs
  const fd = await prisma.sportsbook.findUnique({ where: { name: "FanDuel" } });
  const dk = await prisma.sportsbook.findUnique({
    where: { name: "DraftKings" },
  });
  if (!fd || !dk) throw new Error("books not found after createMany");

  // Insert odds that guarantee arbitrage (2.10/2.10)
  await prisma.odds.createMany({
    data: [
      { marketId: market.id, sportsbookId: fd.id, outcome: "A", decimal: 2.1 },
      { marketId: market.id, sportsbookId: dk.id, outcome: "B", decimal: 2.1 },
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
