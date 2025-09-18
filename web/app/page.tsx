/**
 * This file renders the home page ("/").
 * - It is a "Server Component" in Next.js App Router.
 * - We fetch our API route right here on the server, then send HTML to the browser.
 *
 * Why do it this way for MVP?
 * - Super simple: no client-side data fetching needed
 * - SEO friendly and fast (HTML comes pre-rendered)
 * - Easy to swap API internals later (stub → DB) without changing this page
 */

// import the RefreshButton (client component)
import { RefreshButton } from "@/components/RefreshButton";

type Leg = { book: string; outcome: "A" | "B"; dec: number };
type Opportunity = {
  id: string;
  sport: string;
  league: string;
  startsAt: string; // ISO string
  teamA: string;
  teamB: string;
  roi: number;      // e.g. 0.012 == 1.2%
  legs: Leg[];
};

/**
 * Small helper to fetch from our own API.
 * - We disable caching so the page always reflects latest data on refresh.
 */
async function getOpportunities(): Promise<Opportunity[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/opportunities`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export default async function HomePage() {
  const opps = await getOpportunities();

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Page header */}
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Arbitrage Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Live edges (now DB-backed) — mock refresh for demo
          </p>
        </div>

        {/*adds a client-side refresh action */}
        <RefreshButton />
      </header>

      {/* Results grid */}
      <section className="grid grid-cols-1 gap-4">
        {opps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No opportunities yet. (Try clicking “Refresh odds”)
          </p>
        )}

        {opps.map((o) => {
          const legs = o.legs as Leg[];
          return (
            <div key={o.id} className="rounded-2xl border bg-card shadow-sm p-5">
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

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {legs.map((l, i) => (
                  <div key={i} className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">{l.book}</div>
                    <div className="font-medium">Bet: {l.outcome}</div>
                    <div className="text-sm">Decimal: {l.dec.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
