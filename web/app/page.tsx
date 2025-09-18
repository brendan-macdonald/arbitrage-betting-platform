/**
 * Home page ("/")
 * - Server Component (runs on the server)
 * - Fetches computed arbitrage opportunities from our own API
 * - Renders clean cards with: team to bet, book, American odds, decimal odds
 */

import { RefreshButton } from "@/components/RefreshButton";
import { StakeSplit, type Opportunity as OppForSplit } from "@/components/StakeSplit";

type Leg = { book: string; outcome: "A" | "B"; dec: number };

type Opportunity = {
  id: string;
  sport: string;        // e.g., "American Football"
  league: string;       // e.g., "NCAAF"
  startsAt: string;     // ISO string
  teamA: string;        // we define A as away team in our adapter
  teamB: string;        // we define B as home team in our adapter
  roi: number;          // decimal (0.012 = 1.2%)
  legs: Leg[];          // two legs (A on one book, B on another)
};

/**
 * Convert decimal odds (math-friendly) → American odds (UX-friendly).
 * - If decimal >= 2.0 → underdog → positive American (e.g., 2.21 → +121)
 * - If decimal < 2.0  → favorite  → negative American (e.g., 1.87 → -115)
 */
function toAmerican(decimal: number): string {
  if (decimal >= 2) {
    return `+${Math.round((decimal - 1) * 100)}`;
  }
  return `${Math.round(-100 / (decimal - 1))}`;
}

/**
 * Map leg.outcome ("A" | "B") → the actual team name on the card.
 * We’re using the normalized convention from our adapter:
 *   A = away team, B = home team
 */
function outcomeToTeam(o: Opportunity, outcome: "A" | "B"): string {
  return outcome === "A" ? o.teamA : o.teamB;
}

/**
 * Server-side fetch from our own API.
 * - cache: "no-store" so a page refresh always shows latest computed opportunities.
 */
async function getOpportunities(): Promise<Opportunity[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${base}/api/opportunities?minRoi=0.01`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function HomePage() {
  const opps = await getOpportunities();

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Arbitrage Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Live NCAAF (and more) — books in American odds, decimals for reference
          </p>
        </div>
        <RefreshButton />
      </header>

      <section className="grid grid-cols-1 gap-4">
        {opps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No opportunities yet. Try ingesting odds or refresh again.
          </p>
        )}

        {opps.map((o) => {
          const legs = o.legs as Leg[];

          return (
            <div key={o.id} className="rounded-2xl border bg-card shadow-sm p-5">
              {/* Top row: event info + ROI */}
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

              {/* Bottom row: each leg = which book, which team, American odds, decimal below */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {legs.map((l, i) => {
                  const team = outcomeToTeam(o, l.outcome);
                  const american = toAmerican(l.dec);

                  return (
                    <div key={i} className="rounded-xl border p-3">
                      {/* Book name (source) */}
                      <div className="text-xs text-muted-foreground">{l.book}</div>

                      {/* The bet instruction (this is the key part you asked for) */}
                      <div className="font-medium">Bet: {team} ML</div>

                      {/* Show American odds big (what bettors expect on the book) */}
                      <div className="text-lg font-semibold">{american}</div>

                      {/* Decimal odds smaller for transparency/math cross-checks */}
                      <div className="text-xs text-muted-foreground">(decimal {l.dec.toFixed(2)})</div>
                    </div>
                  );
                })}
              </div>
             <StakeSplit opp={o as OppForSplit} /> 
            </div>
          );
        })}
      </section>
    </main>
  );
}
