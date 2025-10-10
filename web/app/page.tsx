"use client";

// Home page: Arbitrage opportunities dashboard.
// - Filters, ingest, and paginated results.
// - Handles demo mode, filter persistence, and stale odds detection.
// - Contract: Only shows true arbs, all books, paginated, filterable.

import Filters from "@/components/Filters";
import { RefreshButton } from "@/components/RefreshButton";
import {
  StakeSplit,
  type Opportunity as OppForSplit,
} from "@/components/StakeSplit";
import type { MarketKind, ArbLeg } from "@/lib/arbitrage";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { timeAgo } from "@/lib/utils";

type Leg = ArbLeg & {
  dec: number;
  providerUpdatedAt?: string;
  lastSeenAt?: string;
};

type Opportunity = {
  id: string;
  sport: string;
  league: string;
  startsAt: string;
  teamA: string;
  teamB: string;
  roiPct: number;
  market?: MarketKind;
  line?: number;
  legs: Leg[];
};

export default function Home() {
  // Initialize filters from URL, then localStorage, then defaults
  function getInitialFilters() {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlSports = params.get("sports");
      const urlMarkets = params.get("markets");
      const urlMinRoi = params.get("minRoi");
      const urlBookmakers = params.get("bookmakers");
      const sports = urlSports
        ? urlSports.split(",").filter(Boolean)
        : JSON.parse(localStorage.getItem("prefs.sports") || "[]");
      const markets = urlMarkets
        ? urlMarkets.split(",").filter(Boolean)
        : JSON.parse(localStorage.getItem("prefs.markets") || '["h2h"]');
      const minRoi = urlMinRoi
        ? Number(urlMinRoi)
        : Number(localStorage.getItem("prefs.minRoi") || 0.0);
      const bookmakers = urlBookmakers
        ? urlBookmakers.split(",").filter(Boolean)
        : JSON.parse(localStorage.getItem("prefs.bookmakers") || "[]");
      return { sports, markets, minRoi, bookmakers };
    } else {
      // On server, use safe defaults
      return { sports: [], markets: ["h2h"], minRoi: 0.0, bookmakers: [] };
    }
  }
  const [{ sports, markets, minRoi, bookmakers }, setFilters] =
    useState(getInitialFilters);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [demo, setDemo] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 25;

  // Sync filters to URL (keep search params up to date)
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

  // Build query string from filters
  function getQuery(customOffset = offset) {
    const params = new URLSearchParams();
    if (sports.length) params.set("sports", sports.join(","));
    if (markets.length) params.set("markets", markets.join(","));
    if (bookmakers.length) params.set("bookmakers", bookmakers.join(","));
    params.set("minRoi", String(minRoi));
    params.set("freshMins", "10080");
    params.set("limit", String(LIMIT));
    params.set("offset", String(customOffset));
    if (demo) params.set("demo", "1");
    return `/api/opportunities?${params.toString()}`;
  }

  const { data, mutate } = useSWR(
    getQuery(),
    (url) => fetch(url, { cache: "no-store" }).then((res) => res.json()),
    {
      refreshInterval: paused ? 0 : demo ? 30000 : 60000,
      onSuccess: () => setLastUpdated(Date.now()),
      revalidateOnFocus: true,
    }
  );

  useEffect(() => {
    function handleVisibility() {
      const isPaused = document.visibilityState !== "visible";
      setPaused(isPaused);
      if (!isPaused) mutate();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [mutate]);

  useEffect(() => {
    if (data?.opportunities) {
      setOpps(data.opportunities);
      setTotal(data.summary?.total ?? 0);
      setOffset(data.summary?.offset ?? 0);
    }
  }, [data]);

  // Demo mode persistence (unchanged)
  useEffect(() => {
    const stored = localStorage.getItem("demoMode");
    if (stored) setDemo(stored === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("demoMode", demo ? "1" : "0");
  }, [demo]);

  // Load more handler (pagination)
  async function handleLoadMore() {
    setLoadingMore(true);
    const nextOffset = offset + LIMIT;
    const url = getQuery(nextOffset);
    const res = await fetch(url, { cache: "no-store" });
    const more = await res.json();
    setOpps((prev) => [...prev, ...(more.opportunities || [])]);
    setOffset(more.summary?.offset ?? nextOffset);
    setTotal(more.summary?.total ?? total);
    setLoadingMore(false);
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Arbitrage Opportunities
          </h1>
          <p className="text-sm text-muted-foreground">
            Select a sport/region, ingest, and view true arbs (all books).
          </p>
          <Filters
            onChange={({ sports, markets, minRoi, bookmakers }) =>
              setFilters({ sports, markets, minRoi, bookmakers })
            }
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
            Updated {Math.floor((Date.now() - lastUpdated) / 1000)} seconds ago.
            {paused && (
              <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 font-semibold">
                Paused
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <DemoModeToggle demo={demo} setDemo={setDemo} />
          <RefreshButton />
        </div>
      </header>
      <section className="grid grid-cols-1 gap-4">
        {opps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No opportunities yet for these filters. Try “Ingest now”, widen
            freshness, or switch sport.
          </p>
        )}
        {opps.map((o) => {
          const legs = o.legs as Leg[];
          const market = o.market || "ML";
          const line = typeof o.line === "number" ? o.line : undefined;
          const toAmerican = (d: number) =>
            d >= 2
              ? `+${Math.round((d - 1) * 100)}`
              : `${Math.round(-100 / (d - 1))}`;
          const outcomeToTeam = (oo: Opportunity, out: "A" | "B") =>
            out === "A" ? oo.teamA : oo.teamB;
          const marketLabel =
            market === "ML" ? "ML" : market === "SPREAD" ? "Spread" : "Totals";
          return (
            <div
              key={o.id}
              className="rounded-2xl border bg-white/80 shadow-sm p-5 backdrop-blur-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                      {marketLabel}
                    </span>
                    {o.league} • {new Date(o.startsAt).toLocaleString()}
                  </div>
                  <div className="text-lg font-medium flex items-center gap-2">
                    {market === "SPREAD" && line !== undefined ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                        {line > 0 ? `+${line}` : line}
                      </span>
                    ) : null}
                    {market === "TOTAL" && line !== undefined ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                        O/U {line}
                      </span>
                    ) : null}
                    {o.teamA} vs {o.teamB}
                  </div>
                </div>
                <div className="text-right min-w-[80px]">
                  <div className="text-xs text-muted-foreground">ROI</div>
                  <div className="text-2xl font-semibold">
                    {typeof o.roiPct === "number" && isFinite(o.roiPct)
                      ? `${o.roiPct.toFixed(2)}%`
                      : "--"}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {legs.map((l, i) => {
                  let betLabel = "";
                  if (market === "ML") {
                    betLabel = `Bet: ${outcomeToTeam(
                      o,
                      l.outcome as "A" | "B"
                    )} ML`;
                  } else if (market === "SPREAD") {
                    // Show line next to each leg, stick to A/B mapping
                    betLabel = `Bet: ${outcomeToTeam(
                      o,
                      l.outcome as "A" | "B"
                    )} ${
                      typeof l.line === "number"
                        ? l.line > 0
                          ? `+${l.line}`
                          : l.line
                        : ""
                    }`;
                  } else if (market === "TOTAL") {
                    // Show Over/Under plus the line
                    betLabel = `Bet: ${
                      l.outcome === "OVER" ? "OVER" : "UNDER"
                    } ${typeof l.line === "number" ? l.line : ""}`;
                  }
                  const american = toAmerican(l.dec);
                  // Prefer providerUpdatedAt, fallback to lastSeenAt (if available)
                  const lastUpdateIso = l.providerUpdatedAt || l.lastSeenAt;
                  const ago = timeAgo(lastUpdateIso);
                  // Consider stale if older than 5 minutes (300s)
                  let isStale = false;
                  if (lastUpdateIso) {
                    const d = new Date(lastUpdateIso);
                    if (isFinite(d.getTime())) {
                      isStale = Date.now() - d.getTime() > 5 * 60 * 1000; // stale odds logic
                    }
                  }
                  return (
                    <div key={i} className="rounded-xl border p-3">
                      <div className="text-xs text-muted-foreground">
                        {l.book}
                      </div>
                      <div className="font-medium">{betLabel}</div>
                      <div className="text-lg font-semibold">{american}</div>
                      <div className="text-xs text-muted-foreground">
                        (decimal {l.dec.toFixed(2)})
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        Last update: {ago}
                        {isStale && (
                          <span className="ml-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 font-semibold flex items-center gap-1">
                            <span
                              className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse"
                              title="Stale"
                            ></span>
                            <span>stale</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {o.roiPct > 0 && <StakeSplit opp={{ ...o, roi: o.roiPct }} />}
            </div>
          );
        })}
        {opps.length < total && (
          <div className="flex justify-center mt-4">
            {/* Load more button for paginated results */}
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-4 py-2 rounded bg-blue-600 text-white font-semibold disabled:opacity-50"
            >
              {loadingMore
                ? "Loading..."
                : `Load more (${total - opps.length} remaining)`}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

// Inline DemoModeToggle component
function DemoModeToggle({
  demo,
  setDemo,
}: {
  demo: boolean;
  setDemo: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center cursor-pointer select-none">
        <span className="mr-2 text-xs text-muted-foreground">Demo Mode</span>
        <input
          type="checkbox"
          checked={demo}
          onChange={(e) => setDemo(e.target.checked)}
          className="accent-blue-500"
        />
      </label>
      {demo && (
        <span className="ml-1 px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">
          Demo
        </span>
      )}
    </div>
  );
}
