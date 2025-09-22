/**
 * Home page ("/")
 * - Server Component (runs on the server)
 * - Reads sport/region from search params (region is mostly for the ingest button)
 * - Fetches computed arbitrage opportunities filtered by sport
 */

import Filters from "@/components/Filters";
import { RefreshButton } from "@/components/RefreshButton"; // keep if you like
import { StakeSplit, type Opportunity as OppForSplit } from "@/components/StakeSplit";

type Leg = { book: string; outcome: "A" | "B"; dec: number };
type Opportunity = {
  id: string;
  sport: string;
  league: string;
  startsAt: string;
  teamA: string;
  teamB: string;
  roi: number;
  legs: Leg[];
};

async function getOpportunities(sportKey?: string): Promise<Opportunity[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const params = new URLSearchParams({
    minRoi: "0",           // true arbs only; change to "-0.01" for near-arbs
    freshMins: "480",      // wide window so you see results after ingest
    maxSum: "1",           // 1 = true arbs; try "1.005" for near-arbs
  });
  if (sportKey) params.set("sport", sportKey);

  const res = await fetch(`${base}/api/opportunities?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function Home({ searchParams }: { searchParams: Promise<{ sport?: string; region?: string }> }) {
  const params = await searchParams;
  const sportKey = params?.sport;
  const opps = await getOpportunities(sportKey);

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Arbitrage Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Select a sport/region, ingest, and view true arbs (all books).
          </p>
          {/* NEW: the tiny multi-sport control */}
          <Filters />
        </div>
        {/* Keep your manual refresh if you like (it just router.refresh()s) */}
        <RefreshButton />
      </header>

      <section className="grid grid-cols-1 gap-4">
        {opps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No opportunities yet for this sport. Try “Ingest now”, widen freshness, or switch sport.
          </p>
        )}

        {opps.slice(0, 25).map((o) => {
          const legs = o.legs as Leg[];

          // helpers (same as before)
          const toAmerican = (d: number) => (d >= 2 ? `+${Math.round((d - 1) * 100)}` : `${Math.round(-100 / (d - 1))}`);
          const outcomeToTeam = (oo: Opportunity, out: "A" | "B") => (out === "A" ? oo.teamA : oo.teamB);

          return (
            <div key={o.id} className="rounded-2xl border bg-white/80 shadow-sm p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {o.league} • {new Date(o.startsAt).toLocaleString()}
                  </div>
                  <div className="text-lg font-medium">
                    {o.teamA} vs {o.teamB}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">ROI</div>
                  <div className="text-2xl font-semibold">{(o.roi * 100).toFixed(2)}%</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {legs.map((l, i) => {
                  const team = outcomeToTeam(o, l.outcome);
                  const american = toAmerican(l.dec);
                  return (
                    <div key={i} className="rounded-xl border p-3">
                      <div className="text-xs text-muted-foreground">{l.book}</div>
                      <div className="font-medium">Bet: {team} ML</div>
                      <div className="text-lg font-semibold">{american}</div>
                      <div className="text-xs text-muted-foreground">(decimal {l.dec.toFixed(2)})</div>
                    </div>
                  );
                })}
              </div>

              {/* Optional stake calculator (you already have it) */}
              {/* Show only for arbs; or gate behind a dropdown like before */}
              {o.roi > 0 && <StakeSplit opp={o as OppForSplit} />}
            </div>
          );
        })}
      </section>
    </main>
  );
}
