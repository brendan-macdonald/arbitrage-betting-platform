// app/api/ingest-all/route.ts
//
// Optimized batch ingest for recent odds with minimal API usage.
// - US region only
// - H2H only by default
// - Time-window fetch (server-side filter as defense-in-depth)
// - Per-(sport,region,market) TTL to skip refetching too soon
// - Only ingest when there is a true arbitrage opportunity
// - Optional hash guard to skip DB writes when best prices haven't changed
//
// Query params (handy while testing):
//   POST /api/ingest-all?hours=12&ttl=60&concurrency=2&dryRun=1
//   POST /api/ingest-all?sports=americanfootball_nfl,baseball_mlb
//
// NOTE: This route assumes fetchTheOddsApi returns NormalizedEvent[] (see your adapter).

import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { createHash } from "crypto";
import { fetchTheOddsApi, type NormalizedEvent } from "@/lib/oddsAdapters/theOddsApi";
import { ingestNormalizedEvents } from "@/lib/ingest";
import { SPORTS } from "@/lib/oddsAdapters/sports";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ---------------- Tunables (cheap defaults) ---------------- */
const REGION = "us" as const;                 // US only (per your choice)
const MARKETS = ["h2h"] as const;          // H2H only (moneyline) for arbs
const DEFAULT_CONCURRENCY = 3;             // gentle parallelism
const DEFAULT_TIME_WINDOW_HOURS = 12;      // fetch games in next N hours
const DEFAULT_TTL_SECONDS = 60;            // per-combo TTL (sport+region+market)
const ARB_THRESHOLD = 1.0;                 // sum(1/price) < 1 -> theoretical arb
const BASE_BACKOFF_MS = 800;               // 0.8s base backoff for 429
const MAX_RETRIES_429 = 3;

/** ---------------- In-process caches ---------------- */
// TTL: last fetch time per (sport|region|market)
const lastFetchAtByCombo = new Map<string, number>();
// Event-level odds hash to avoid DB writes when best prices unchanged
const lastOddsHashByEvent = new Map<string, string>();

/** Utilities */
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function withBackoff<T>(fn: () => Promise<T>, retries = MAX_RETRIES_429) {
  let attempt = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastErr: any;
  while (attempt <= retries) {
    try {
      return await fn();
  } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const is429 = e?.status === 429 || msg.includes("EXCEEDED_FREQ_LIMIT");
      if (!is429 || attempt === retries) throw e;
      await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt)); // 0.8s, 1.6s, 3.2s...
      attempt++;
    }
  }
  throw lastErr;
}

async function ensureDb() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new Error("DB_UNAVAILABLE");
  }
}

type DetailRow = {
  sport: string;
  region: string;
  market: string;
  events: number;   // processed
  odds: number;     // written
  note?: "no-events" | "no-arb" | "skipped" | "error" | "ttl-skip" | "no-change";
  error?: string;
};

function comboKey(s: string, r: string, m: string) {
  return `${s}|${r}|${m}`;
}

function shouldSkipByTTL(sport: string, region: string, market: string, ttlSeconds: number) {
  const key = comboKey(sport, region, market);
  const last = lastFetchAtByCombo.get(key) ?? 0;
  const now = Date.now();
  if (now - last < ttlSeconds * 1000) return true;
  lastFetchAtByCombo.set(key, now);
  return false;
}

/** Compute event "best price" hash (A-side & B-side) to skip unchanged writes */
function computeEventOddsHash(ev: NormalizedEvent): string {
  // get max decimal for A and B across books in this normalized shape
  let bestA = 0, bestB = 0;
  for (const line of ev.lines ?? []) {
    if (line.outcome === "A") bestA = Math.max(bestA, Number(line.decimal) || 0);
    if (line.outcome === "B") bestB = Math.max(bestB, Number(line.decimal) || 0);
  }
  const s = `A:${bestA}|B:${bestB}`;
  return createHash("sha1").update(s).digest("hex");
}

/** True if event has an arb on H2H (2- or 3-way handled by normalization rules) */
function hasH2HArb(ev: NormalizedEvent, threshold = ARB_THRESHOLD): boolean {
  // Best A & B across books
  let bestA = 0, bestB = 0;
  for (const line of ev.lines ?? []) {
    const price = Number(line.decimal);
    if (!isFinite(price) || price <= 1) continue;
    if (line.outcome === "A") bestA = Math.max(bestA, price);
    if (line.outcome === "B") bestB = Math.max(bestB, price);
  }
  // If you ever add draws (soccer 3-way) to the normalized shape, extend this.
  if (bestA <= 1 || bestB <= 1) return false;
  const sumInverse = 1 / bestA + 1 / bestB;
  return sumInverse < threshold;
}

function withinWindow(ev: NormalizedEvent, fromISO: string, toISO: string) {
  const t = new Date(ev.startsAt).toISOString();
  return t >= fromISO && t <= toISO;
}

export async function POST(request: Request) {
  // -------- params for quick testing/tuning --------
  const url = new URL(request.url);
  const qpSports = url.searchParams.get("sports")?.split(",").filter(Boolean); // limit sports set
  const qpHours = Number(url.searchParams.get("hours"));
  const qpTTL = Number(url.searchParams.get("ttl"));
  const qpConcurrency = Number(url.searchParams.get("concurrency"));
  const dryRun = url.searchParams.get("dryRun") === "1";

  const TIME_WINDOW_HOURS =
    Number.isFinite(qpHours) && qpHours > 0 ? qpHours : DEFAULT_TIME_WINDOW_HOURS;
  const TTL_SECONDS =
    Number.isFinite(qpTTL) && qpTTL >= 0 ? qpTTL : DEFAULT_TTL_SECONDS;
  const CONCURRENCY =
    Number.isFinite(qpConcurrency) && qpConcurrency > 0 ? qpConcurrency : DEFAULT_CONCURRENCY;

  const sportsList = qpSports?.length ? qpSports : SPORTS;

  const now = new Date();
  const to = new Date(now.getTime() + TIME_WINDOW_HOURS * 60 * 60 * 1000);
  const fromISO = now.toISOString();
  const toISO = to.toISOString();

  // ---- DB check to avoid burning API credits if DB is down ----
  try {
    await ensureDb();
  } catch {
    return NextResponse.json(
      { ok: false, totalEvents: 0, totalOdds: 0, errors: ["database not reachable at start"], details: [] as DetailRow[] },
      { status: 503 }
    );
  }

  const limit = pLimit(CONCURRENCY);

  let totalEvents = 0;
  let totalOdds = 0;
  const errors: string[] = [];
  const details: DetailRow[] = [];

  let outOfCredits = false; // stop further work if provider says out of usage

  const tasks: Array<Promise<void>> = [];

  for (const sport of sportsList) {
    for (const market of MARKETS) {
      // TTL gate per (sport, region, market)
      if (TTL_SECONDS > 0 && shouldSkipByTTL(sport, REGION, market, TTL_SECONDS)) {
        details.push({ sport, region: REGION, market, events: 0, odds: 0, note: "ttl-skip" });
        continue;
      }

      tasks.push(
        limit(async () => {
          if (outOfCredits) {
            details.push({ sport, region: REGION, market, events: 0, odds: 0, note: "skipped" });
            return;
          }

          try {
            // Fetch normalized events for our window, us region, H2H
            const events = await withBackoff(() =>
              fetchTheOddsApi({
                sport,
                region: REGION,
                market,
                // pass time window to adapter; we also filter below
                commenceTimeFrom: fromISO,
                commenceTimeTo: toISO,
              })
            );

            if (!Array.isArray(events) || events.length === 0) {
              details.push({ sport, region: REGION, market, events: 0, odds: 0, note: "no-events" });
              return;
            }

            // Keep only events inside the time window and with a real arb
            const shortlisted = events
              .filter((e) => withinWindow(e, fromISO, toISO))
              .filter((e) => hasH2HArb(e, ARB_THRESHOLD));

            if (shortlisted.length === 0) {
              details.push({ sport, region: REGION, market, events: 0, odds: 0, note: "no-arb" });
              return;
            }

            // Optional: skip DB writes when best prices haven't changed
            const toIngest: NormalizedEvent[] = [];
            for (const e of shortlisted) {
              const stableId = `${e.teamA}@${e.teamB}:${e.startsAt}:${sport}:${market}`;
              const hash = computeEventOddsHash(e);
              const prev = lastOddsHashByEvent.get(stableId);
              if (prev && prev === hash) {
                details.push({ sport, region: REGION, market, events: 1, odds: 0, note: "no-change" });
                continue;
              }
              lastOddsHashByEvent.set(stableId, hash);
              toIngest.push(e);
            }

            if (toIngest.length === 0) return;

            if (dryRun) {
              details.push({ sport, region: REGION, market, events: toIngest.length, odds: 0, note: "skipped" });
              return;
            }

            const { eventsTouched, oddsWritten } = await ingestNormalizedEvents(toIngest);
            totalEvents += eventsTouched;
            totalOdds += oddsWritten;
            details.push({ sport, region: REGION, market, events: eventsTouched, odds: oddsWritten });
          } catch (e) {
            const err = e as any;
            const msg = String(err?.message || err);
            errors.push(`${sport}/${REGION}/${market}: ${msg}`);
            details.push({ sport, region: REGION, market, events: 0, odds: 0, note: "error", error: msg.slice(0, 300) });
            // Stop batch if we ran out of credits
            const is401Out = err?.status === 401 || msg.includes("OUT_OF_USAGE_CREDITS");
            if (is401Out) outOfCredits = true;
          }
        })
      );
    }
  }

  await Promise.all(tasks);

  return NextResponse.json({
    ok: errors.length === 0,
    totalEvents,
    totalOdds,
    errors,
    summary: {
      sports: SPORTS.length,
      region: REGION,
      markets: MARKETS,
      concurrency: CONCURRENCY,
      hours: TIME_WINDOW_HOURS,
      ttlSeconds: TTL_SECONDS,
      stoppedEarly: outOfCredits,
      dryRun,
    },
    details,
  });
}

