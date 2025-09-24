"use client";
/**
 * StakeSplit (collapsible)
 * ------------------------
 * Same math as before, but wrapped in a native <details> so it’s hidden by default.
 * - Accessible out of the box (keyboard + screen readers)
 * - No extra deps
 * - Click the summary row to expand/collapse
 */

import { useMemo, useState } from "react";

export type Leg = { book: string; outcome: "A" | "B"; dec: number };
export type Opportunity = {
  id: string;
  sport: string;
  league: string;
  startsAt: string;
  teamA: string;
  teamB: string;
  roi: number;
  market?: "ML" | "SPREAD" | "TOTAL";
  line?: number;
  legs: Leg[];
};

// Decimal → American odds (UX-friendly)
function toAmerican(decimal: number): string {
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
}

// A|B → team name (A = away, B = home as per our adapter)
function outcomeToTeam(o: Opportunity, outcome: "A" | "B") {
  return outcome === "A" ? o.teamA : o.teamB;
}

export function StakeSplit({ opp, defaultOpen = false }: { opp: Opportunity; defaultOpen?: boolean }) {
  // Total stake to split across the two legs
  const [stake, setStake] = useState<number>(100);

  // Use first two legs for split
  const legs = opp.legs.slice(0, 2);
  const [legA, legB] = legs;

  // Market and line info
  const market = opp.market || 'ML';
  const line = typeof opp.line === 'number' ? opp.line : undefined;

  // Bet label logic
  function getBetLabel(leg: Leg) {
    if (market === 'ML') {
      return `Bet: ${outcomeToTeam(opp, leg.outcome as "A" | "B")} ML`;
    } else if (market === 'SPREAD') {
      return `Bet: ${outcomeToTeam(opp, leg.outcome as "A" | "B")}${typeof leg.line === 'number' ? ` ${leg.line > 0 ? `+${leg.line}` : leg.line}` : ''}`;
    } else if (market === 'TOTAL') {
      return `Bet: ${leg.outcome === 'OVER' ? 'OVER' : 'UNDER'} ${leg.line}`;
    }
    return '';
  }

  // Calculation logic (same math, but always use opp.roi for display)
  const calc = useMemo(() => {
    if (!legA || !legB) return null;
    const dA = legA.dec;
    const dB = legB.dec;
    const invSum = 1 / dA + 1 / dB;
    // Use ROI from opportunity for display, not recalculated
    const roi = typeof opp.roi === 'number' ? opp.roi : (invSum < 1 ? 1 - invSum : 0);
    const pA = (1 / dA) / invSum;
    const pB = (1 / dB) / invSum;
    const stakeA = stake * pA;
    const stakeB = stake * pB;
    const payoutIfA = stakeA * dA;
    const payoutIfB = stakeB * dB;
    const profitA = payoutIfA - stake;
    const profitB = payoutIfB - stake;
    const optimalProfit = Math.max(profitA, profitB);
    const $ = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pct = (n: number) => (n * 100).toFixed(2) + "%";
    return { invSum, roi, stakeA, stakeB, payoutIfA, payoutIfB, profitA, profitB, optimalProfit, fmt: { $, pct } };
  }, [stake, legA, legB, opp.id, opp.roi]);

  if (!legA || !legB || !calc) return null;

  return (
    <details className="mt-3 rounded-xl border bg-muted/20" {...(defaultOpen ? { open: true } : {})}>
      {/* SUMMARY ROW (always visible) */}
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-xl px-4 py-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Stake split ({market}{line !== undefined ? ` ${line}` : ''})</div>
          <div className="text-xs text-muted-foreground">
            Click to {defaultOpen ? "collapse" : "expand"}. {calc.roi > 0 ? `ROI ${calc.fmt.pct(calc.roi)}` : "No guaranteed profit"}
          </div>
        </div>

        {/* Small inline info so you don’t need to open it every time */}
        <div className="text-right text-sm">
          <div className="text-xs text-muted-foreground">Assuming ${stake}</div>
          {calc.roi > 0 ? (
            <div className="font-semibold">
              Profit ${calc.fmt.$(calc.profitA)} ({calc.fmt.pct(calc.roi)})
            </div>
          ) : (
            <div className="text-amber-600 font-medium">No arb</div>
          )}
        </div>
      </summary>

      {/* PANEL CONTENT (hidden until expanded) */}
      <div className="border-t px-4 py-4">
        {/* Stake input */}
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div className="space-y-1">
            <div className="text-sm font-medium">How it works</div>
            <div className="text-xs text-muted-foreground">
              We split by inverse odds to maximize profit. The optimal profit is shown below, which may differ depending on which leg wins.
            </div>
          </div>
          <label className="text-sm">
            Total stake ($):{" "}
            <input
              type="number"
              min={0}
              step="1"
              value={stake}
              onChange={(e) => setStake(Number(e.target.value || 0))}
              className="ml-2 inline-flex h-8 w-28 rounded-md border px-2"
            />
          </label>
        </div>

        {/* Two legs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{legA.book}</div>
            <div className="font-medium">{getBetLabel(legA)}</div>
            <div className="text-lg font-semibold">{toAmerican(legA.dec)}</div>
            <div className="text-xs text-muted-foreground">(decimal {legA.dec.toFixed(2)})</div>

            <div className="mt-2 text-sm">
              Stake: <span className="font-semibold">${calc.fmt.$(calc.stakeA)}</span>
            </div>
            <div className="text-xs text-muted-foreground">Payout if wins: ${calc.fmt.$(calc.payoutIfA)}</div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{legB.book}</div>
            <div className="font-medium">{getBetLabel(legB)}</div>
            <div className="text-lg font-semibold">{toAmerican(legB.dec)}</div>
            <div className="text-xs text-muted-foreground">(decimal {legB.dec.toFixed(2)})</div>

            <div className="mt-2 text-sm">
              Stake: <span className="font-semibold">${calc.fmt.$(calc.stakeB)}</span>
            </div>
            <div className="text-xs text-muted-foreground">Payout if wins: ${calc.fmt.$(calc.payoutIfB)}</div>
          </div>
        </div>

        {/* Footer line with math reference */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            {calc.roi > 0 ? (
              <>
                Optimal profit: <span className="font-semibold">${calc.fmt.$(calc.optimalProfit)}</span>{" "}
                (<span className="font-semibold">{calc.fmt.pct(calc.roi)}</span>)
              </>
            ) : (
              <span className="text-amber-600">
                No guaranteed profit (inverse sum ≥ 1). This split equalizes payout only.
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            invSum = {calc.invSum.toFixed(4)} • ROI = {(calc.roi * 100).toFixed(2)}%
          </div>
        </div>
      </div>
    </details>
  );
}
