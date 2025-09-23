// lib/oddsAdapters/theOddsApi.ts
//
// Adapter for The Odds API
// - Handles HTTP requests and raw JSON shape from provider
// - Normalizes events into provider-agnostic shape (NormalizedEvent)
// - Supports optional commence_time filters to reduce API usage
//
// This file is isolated so that you can later add new providers
// while keeping the rest of your ingest pipeline unchanged.

export type RawOddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string; // ISO
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;       // e.g., "draftkings"
    title: string;     // e.g., "DraftKings"
    markets: Array<{
      key: string;     // e.g., "h2h"
      outcomes: Array<{
        name: string;  // team name
        price: number; // decimal odds
      }>;
    }>;
  }>;
};

/**
 * Normalized event shape used throughout our app.
 * - One record per event
 * - Each contains an array of "lines" (odds) across different books
 */
export type NormalizedEvent = {
  league: string;       // e.g., "NBA"
  sport: string;        // e.g., "Basketball"
  startsAt: string;     // ISO string
  teamA: string;        // deterministic ordering: away = A
  teamB: string;        // home = B
  lines: Array<{
    book: string;       // e.g., "DraftKings"
    outcome: "A" | "B";
    decimal: number;
  }>;
};

/** Helper: capitalize + tidy strings */
function titleCase(input: string): string {
  return input
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Map sport_title → sport + league fields.
 * Examples:
 *   "Basketball (NBA)" → { sport: "Basketball", league: "NBA" }
 *   "Baseball" → { sport: "Baseball", league: "Baseball" }
 */
function splitSportTitle(sportTitle: string): { sport: string; league: string } {
  const m = sportTitle.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (m) {
    return { sport: m[1].trim(), league: m[2].trim() };
  }
  return { sport: sportTitle.trim(), league: sportTitle.trim() };
}

/** Ensure format "YYYY-MM-DDTHH:MM:SSZ" (drop milliseconds) */
function toIsoSeconds(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Fetch odds from The Odds API and normalize them.
 *
 * Docs: https://theoddsapi.com/
 *
 * Options:
 * - sport: string (e.g., "basketball_nba")
 * - region: string (e.g., "us")
 * - market: string ("h2h", "spreads", "totals")
 * - commenceTimeFrom / commenceTimeTo: ISO strings for windowing
 */
export async function fetchTheOddsApi(options?: {
  apiKey?: string;
  sport?: string;
  region?: string;
  market?: string;
  commenceTimeFrom?: string;
  commenceTimeTo?: string;
  bookmakers?: string[];
}): Promise<NormalizedEvent[]> {
  const apiKey = options?.apiKey ?? process.env.ODDS_API_KEY!;
  const sport  = options?.sport  ?? process.env.ODDS_API_SPORT ?? "basketball_nba";
  const region = options?.region ?? process.env.ODDS_API_REGION ?? "us";
  const market = options?.market ?? process.env.ODDS_API_MARKET ?? "h2h";

  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds`);
  url.searchParams.set("regions", region);
  url.searchParams.set("markets", market);
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  // ✅ Canonicalize to "YYYY-MM-DDTHH:MM:SSZ" (no milliseconds)
  if (options?.commenceTimeFrom) {
    const from = toIsoSeconds(options.commenceTimeFrom);
    url.searchParams.set("commenceTimeFrom", from);
    url.searchParams.set("commence_time_from", from);
  }
  if (options?.commenceTimeTo) {
    const to = toIsoSeconds(options.commenceTimeTo);
    url.searchParams.set("commenceTimeTo", to);
    url.searchParams.set("commence_time_to", to);
  }

  url.searchParams.set("apiKey", apiKey);
  if (options?.bookmakers && options.bookmakers.length) {
    url.searchParams.set("bookmakers", options.bookmakers.join(","));
  }

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
  const text = await res.text();
  const err = new Error(`TheOddsAPI error ${res.status}: ${text}`) as Error & { status?: number };
  err.status = res.status;
  throw err;
  }

  const raw: RawOddsApiEvent[] = await res.json();
  const normalized: NormalizedEvent[] = [];

  for (const ev of raw) {
    const { league } = splitSportTitle(ev.sport_title || titleCase(ev.sport_key));

    // Always use sport_key for normalized sport field
    const sport = ev.sport_key;

    // Deterministic ordering: away = A, home = B
    const teamA = ev.away_team.trim();
    const teamB = ev.home_team.trim();

    const lines: NormalizedEvent["lines"] = [];

    for (const book of ev.bookmakers ?? []) {
      const ml = (book.markets ?? []).find((m) => m.key === "h2h");
      if (!ml) continue;

      for (const out of ml.outcomes ?? []) {
        const name = (out.name || "").trim();
        if (name === teamA) {
          lines.push({ book: book.title || book.key, outcome: "A", decimal: out.price });
        } else if (name === teamB) {
          lines.push({ book: book.title || book.key, outcome: "B", decimal: out.price });
        }
        // ignore "draw" or unrelated outcomes
      }
    }

    if (lines.length > 0) {
      normalized.push({
        league,
        sport,
        startsAt: ev.commence_time,
        teamA,
        teamB,
        lines,
      });
    }
  }

  return normalized;
}
