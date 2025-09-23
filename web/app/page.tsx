"use client";

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

export default function Home() {
  // Initialize from URL, then localStorage, then defaults
  function getInitialFilters() {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlSports = params.get("sports");
      const urlMarkets = params.get("markets");
      const urlMinRoi = params.get("minRoi");
      const urlBookmakers = params.get("bookmakers");
      const sports = urlSports ? urlSports.split(",").filter(Boolean) : JSON.parse(localStorage.getItem("prefs.sports") || "[]");
      const markets = urlMarkets ? urlMarkets.split(",").filter(Boolean) : JSON.parse(localStorage.getItem("prefs.markets") || '["h2h"]');
      const minRoi = urlMinRoi ? Number(urlMinRoi) : Number(localStorage.getItem("prefs.minRoi") || 0.0);
      const bookmakers = urlBookmakers ? urlBookmakers.split(",").filter(Boolean) : JSON.parse(localStorage.getItem("prefs.bookmakers") || "[]");
      return { sports, markets, minRoi, bookmakers };
    } else {
      // On server, use safe defaults
      return { sports: [], markets: ["h2h"], minRoi: 0.0, bookmakers: [] };
    }
  }
  const [{ sports, markets, minRoi, bookmakers }, setFilters] = useState(getInitialFilters);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [demo, setDemo] = useState(false);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (sports.length) params.set("sports", sports.join(","));
    if (markets.length) params.set("markets", markets.join(","));
    if (minRoi !== 1.0) params.set("minRoi", String(minRoi));
    // Remove legacy keys if present
    params.delete("sport");
    params.delete("market");
    window.history.replaceState(null, "", `/?${params.toString()}`);
  }, [sports, markets, minRoi]);

  // Fetch opps on filter/demo change
  useEffect(() => {
    const params = new URLSearchParams();
    if (sports.length) params.set("sports", sports.join(","));
    if (markets.length) params.set("markets", markets.join(","));
    if (bookmakers.length) params.set("bookmakers", bookmakers.join(","));
    params.set("minRoi", String(minRoi));
    params.set("freshMins", "10080"); // 7 days freshness window
    if (demo) params.set("demo", "1");
    // Remove legacy keys if present
    params.delete("sport");
    params.delete("market");
    fetch(`/api/opportunities?${params.toString()}`, { cache: "no-store" })
      .then(res => res.ok ? res.json() : { opportunities: [] })
      .then(data => setOpps(data.opportunities || []));
  }, [sports, markets, minRoi, bookmakers, demo]);

  // Demo mode persistence (unchanged)
  useEffect(() => {
    const stored = localStorage.getItem("demoMode");
    if (stored) setDemo(stored === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("demoMode", demo ? "1" : "0");
  }, [demo]);

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Arbitrage Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Select a sport/region, ingest, and view true arbs (all books).
          </p>
          <Filters
            onChange={({ sports, markets, minRoi, bookmakers }) => setFilters({ sports, markets, minRoi, bookmakers })}
          />
        </div>
        <div className="flex flex-col items-end gap-2">
          <DemoModeToggle demo={demo} setDemo={setDemo} />
          <RefreshButton />
        </div>
      </header>
      <section className="grid grid-cols-1 gap-4">
        {opps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No opportunities yet for these filters. Try “Ingest now”, widen freshness, or switch sport.
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

// Inline DemoModeToggle component
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
