/**
 * Home page ("/")
 * - Server Component (runs on the server)
 * - Reads sport/region from search params (region is mostly for the ingest button)
 * - Fetches computed arbitrage opportunities filtered by sport
 */

import Filters from "@/components/Filters";
import { RefreshButton } from "@/components/RefreshButton";
import { StakeSplit, type Opportunity as OppForSplit } from "@/components/StakeSplit";
import { useEffect, useState } from "react";

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

function DemoModeToggle({ demo, setDemo }: { demo: boolean; setDemo: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center cursor-pointer select-none">
        <span className="mr-2 text-xs text-muted-foreground">Demo Mode</span>
        <input
          type="checkbox"
          checked={demo}
          onChange={e => setDemo(e.target.checked)}
          className="accent-blue-500"
        />
      </label>
      {demo && <span className="ml-1 px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">Demo</span>}
    </div>
  );
}

export default function Home({ searchParams }: { searchParams: Promise<{ sport?: string; region?: string }> }) {
  const [demo, setDemo] = useState(false);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const sportKey = searchParams?.sport;

  useEffect(() => {
    const stored = localStorage.getItem("demoMode");
    if (stored) setDemo(stored === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("demoMode", demo ? "1" : "0");
  }, [demo]);
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const params = new URLSearchParams({
      minRoi: "0",
      freshMins: "480",
      maxSum: "1",
    });
    if (sportKey) params.set("sport", sportKey);
    if (demo) params.set("demo", "1");
    fetch(`${base}/api/opportunities?${params.toString()}`, { cache: "no-store" })
      .then(res => res.ok ? res.json() : [])
      .then(setOpps);
  }, [sportKey, demo]);

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Arbitrage Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Select a sport/region, ingest, and view true arbs (all books).
          </p>
          <Filters />
        </div>
        <div className="flex flex-col items-end gap-2">
          <DemoModeToggle demo={demo} setDemo={setDemo} />
          <RefreshButton />
        </div>
      </header>
      <section className="grid grid-cols-1 gap-4">
        {opps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No opportunities yet for this sport. Try “Ingest now”, widen freshness, or switch sport.
          </p>
        )}
        {opps.slice(0, 25).map((o) => {
          const legs = o.legs as Leg[];
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
              {o.roi > 0 && <StakeSplit opp={o as OppForSplit} />}
            </div>
          );
        })}
      </section>
    </main>
  );
}
