import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // DB connection check
    await prisma.$queryRaw`SELECT 1`;

    // Latest odds update
    const latest = await prisma.odds.findFirst({
      orderBy: { lastSeenAt: "desc" },
      select: { lastSeenAt: true },
    });

    // Count of future events
    const now = new Date();
    const futureEvents = await prisma.event.count({
      where: { startsAt: { gt: now } },
    });

    // Total odds rows
    const oddsRows = await prisma.odds.count();

    return NextResponse.json({
      db: true,
      lastIngestAt: latest?.lastSeenAt?.toISOString(),
      futureEvents,
      oddsRows,
    });
  } catch {
    return NextResponse.json({ db: false }, { status: 500 });
  }
}
