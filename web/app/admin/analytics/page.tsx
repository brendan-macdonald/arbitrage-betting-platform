
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { twoWayArbROI } from "@/lib/arbitrage";

async function getEventsNext24h() {
  const now = new Date();
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return prisma.event.count({
    where: { startsAt: { gte: now, lte: to } },
  });
}

async function getUniqueSports() {
  const sports = await prisma.event.findMany({
    distinct: ["sport"],
    select: { sport: true },
    where: { startsAt: { gte: new Date() } },
  });
  return sports.length;
}

async function getUniqueBooks() {
  const books = await prisma.sportsbook.count();
  return books;
}

async function getMostRecentEvent() {
  const event = await prisma.event.findFirst({
    orderBy: { startsAt: "desc" },
    select: { sport: true, league: true, teamA: true, teamB: true, startsAt: true },
  });
  return event;
}

async function getMostPopularSport() {
  const agg = await prisma.event.groupBy({
    by: ["sport"],
    _count: { sport: true },
    orderBy: { _count: { sport: "desc" } },
    take: 1,
  });
  return agg[0]?.sport || null;
}

async function getOddsRowsLast24h() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.odds.count({ where: { lastSeenAt: { gte: since } } });
}

async function getTotalOddsRows() {
  return prisma.odds.count();
}

async function getArbsLast24h() {
  // Find all ML markets with odds updated in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const markets = await prisma.market.findMany({
    where: { type: "ML", odds: { some: { lastSeenAt: { gte: since } } } },
    include: {
      odds: {
        where: { lastSeenAt: { gte: since } },
        include: { sportsbook: true },
      },
      event: true,
    },
    take: 100,
  });
  let count = 0;
  for (const m of markets) {
    let bestA = null, bestB = null;
    for (const o of m.odds) {
      if (o.outcome === "A" && (!bestA || o.decimal > bestA.decimal)) bestA = o;
      if (o.outcome === "B" && (!bestB || o.decimal > bestB.decimal)) bestB = o;
    }
    if (!bestA || !bestB) continue;
    if (bestA.sportsbookId === bestB.sportsbookId) continue;
    const roi = twoWayArbROI(bestA.decimal, bestB.decimal);
    if (roi >= 0.005) count++;
  }
  return count;
}

async function getLastIngestTime() {
  const last = await prisma.odds.findFirst({
    orderBy: { lastSeenAt: "desc" },
    select: { lastSeenAt: true },
  });
  return last?.lastSeenAt || null;
}

export default async function AnalyticsAdminPage() {

  const [events24h, oddsRows, arbs24h, lastIngest, uniqueSports, uniqueBooks, mostRecentEvent, mostPopularSport, oddsRows24h] = await Promise.all([
    getEventsNext24h(),
    getTotalOddsRows(),
    getArbsLast24h(),
    getLastIngestTime(),
    getUniqueSports(),
    getUniqueBooks(),
    getMostRecentEvent(),
    getMostPopularSport(),
    getOddsRowsLast24h(),
  ]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto py-12">
      <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Events next 24h</span>
            <Badge variant="secondary">Live</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-4xl font-extrabold text-blue-700">{events24h ?? <span className="text-muted-foreground">No data</span>}</span>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Total odds rows</span>
            <Badge variant="outline">All Time</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-4xl font-extrabold text-green-700">{oddsRows ?? <span className="text-muted-foreground">No data</span>}</span>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-yellow-50 to-white border-yellow-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Arbs found (24h, ROI ≥ 0.5%)</span>
            <Badge variant="default">Hot</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-4xl font-extrabold text-yellow-700">{arbs24h ?? <span className="text-muted-foreground">No data</span>}</span>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Last ingest time</span>
            <Badge variant="outline">System</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-lg font-semibold">{lastIngest ? new Date(lastIngest).toLocaleString() : <span className="text-muted-foreground">No data</span>}</span>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-pink-50 to-white border-pink-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Unique sports (upcoming)</span>
            <Badge variant="secondary">Diversity</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold text-pink-700">{uniqueSports ?? <span className="text-muted-foreground">No data</span>}</span>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Unique sportsbooks</span>
            <Badge variant="outline">Coverage</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold text-indigo-700">{uniqueBooks ?? <span className="text-muted-foreground">No data</span>}</span>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Odds rows (last 24h)</span>
            <Badge variant="default">Fresh</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold text-orange-700">{oddsRows24h ?? <span className="text-muted-foreground">No data</span>}</span>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Most recent event</span>
            <Badge variant="secondary">Latest</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mostRecentEvent ? (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-sky-700">{mostRecentEvent.sport} {mostRecentEvent.league && `(${mostRecentEvent.league})`}</span>
              <span className="text-base">{mostRecentEvent.teamA} vs {mostRecentEvent.teamB}</span>
              <span className="text-xs text-muted-foreground">{new Date(mostRecentEvent.startsAt).toLocaleString()}</span>
            </div>
          ) : <span className="text-muted-foreground">No data</span>}
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-lime-50 to-white border-lime-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Most popular sport</span>
            <Badge variant="default">Top</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-2xl font-bold text-lime-700">{mostPopularSport ?? <span className="text-muted-foreground">No data</span>}</span>
        </CardContent>
      </Card>
    </div>
  );
}
