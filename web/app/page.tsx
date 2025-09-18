/**
 * Home page ("/")
 * - Server Component
 * - Fetches arbitrage opportunities (ROI ≥ 1%) from our API
 * - Glossy “pastel glass” cards + collapsible Stake Split panel
 */

import { RefreshButton } from "@/components/RefreshButton";
import { StakeSplit, type Opportunity as OppForSplit } from "@/components/StakeSplit";

type Leg = { book: string; outcome: "A" | "B"; dec: number };

type Opportunity = {
  id: string;
  sport: string;        // e.g., "American Football"
  league: string;       // e.g., "NCAAF"
  startsAt: string;     // ISO string
  teamA: string;        // A = away (adapter)
  teamB: string;        // B = home (adapter)
  roi: number;          // decimal (0.012 = 1.2%)
  legs: Leg[];          // two legs (A on one book, B on another)
};

/** Decimal → American odds (bettor-friendly) */
function toAmerican(decimal: number): string {
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
}

/** Map outcome → team name (A = away, B = home) */
function outcomeToTeam(o: Opportunity, outcome: "A" | "B"): string {
  return outcome === "A" ? o.teamA : o.teamB;
}

/** Server-side fetch (no-store = fresh on each reload) */
async function getOpportunities(): Promise<Opportunity[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  // Only return opportunities with ROI ≥ 1%
  const res = await fetch(`${base}/api/opportunities?minRoi=0.01`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default async function HomePage() {
  const opps = await getOpportunities();

  return (
    <main className="space-y-6">
      {/* Header */}
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Arbitrage Opportunities</h1>
          <p className="text-sm text-slate-500">
            ROI ≥ 1% • American odds prominent • decimals for reference
          </p>
        </div>
        <RefreshButton />
      </header>

      {/* Cards */}
      <section className="grid grid-cols-1 gap-5">
        {opps.length === 0 && (
          <p className="text-sm text-slate-500">
            No opportunities at this threshold. Try ingesting odds or lowering the filter.
          </p>
        )}

        {opps.map((o) => {
          const legs = o.legs as Leg[];

          return (
            <div
              key={o.id}
              className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/85 p-5 shadow-lg backdrop-blur-md ring-1 ring-black/5"
            >
              {/* Glossy sheen overlay */}
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/40 via-transparent to-transparent" />

              {/* Card content */}
              <div className="relative z-10">
                {/* Top row: event info + ROI pill */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500">
                      {o.league} • {new Date(o.startsAt).toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-lg font-semibold tracking-tight">
                      {o.teamA} <span className="text-slate-400">vs</span> {o.teamB}
                    </div>
                  </div>

                  <div className="rounded-full bg-gradient-to-r from-indigo-100 to-pink-100 px-3 py-1 text-right shadow-sm ring-1 ring-black/5">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">ROI</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {(o.roi * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Legs grid */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {legs.map((l, i) => {
                    const team = outcomeToTeam(o, l.outcome);
                    const american = toAmerican(l.dec);
                    return (
                      <div
                        key={i}
                        className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm backdrop-blur-sm ring-1 ring-black/5"
                      >
                        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 via-transparent to-transparent" />
                        <div className="relative z-10">
                          <div className="text-xs text-slate-500">{l.book}</div>
                          <div className="mt-0.5 font-medium">Bet: {team} ML</div>
                          <div className="text-xl font-semibold">{american}</div>
                          <div className="text-xs text-slate-500">(decimal {l.dec.toFixed(2)})</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Collapsible stake split (only when ROI ≥ 1%) */}
                {o.roi >= 0.01 && <StakeSplit opp={o as OppForSplit} />}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
