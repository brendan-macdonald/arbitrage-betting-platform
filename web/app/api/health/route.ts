import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Health check endpoint. Verifies DB connection and basic stats.
export async function GET() {
  try {
    // DB connection check; fail fast if unreachable
    await prisma.$queryRaw`SELECT 1`;

    // Get latest odds update timestamp
    const latest = await prisma.odds.findFirst({
      orderBy: { lastSeenAt: "desc" },
      select: { lastSeenAt: true },
    });

    // Count future events for sanity
    const now = new Date();
    const futureEvents = await prisma.event.count({
      where: { startsAt: { gt: now } },
    });

    // Total odds rows for quick monitoring
    const oddsRows = await prisma.odds.count();

    // Shape response for health dashboard
    return NextResponse.json({
      db: true,
      lastIngestAt: latest?.lastSeenAt?.toISOString(),
      futureEvents,
      oddsRows,
    });
  } catch {
    // DB unreachable
    return NextResponse.json({ db: false }, { status: 500 });
  }
}
