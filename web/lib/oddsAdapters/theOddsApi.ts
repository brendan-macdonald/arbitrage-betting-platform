/**
 * The Odds API adapter
 * - Fetches upcoming events + bookmaker prices for a sport/region/market
 * - Normalizes to a provider-agnostic shape the rest of the app understands
 *
 * Why an "adapter" file?
 * - Separation of concerns: HTTP & provider-specific JSON stays here.
 * - You can add more providers later by returning the same normalized shape.
 */

type RawOddsApiEvent = {
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
      key: string;     // "h2h" for moneyline
      outcomes: Array<{
        name: string;  // team name
        price: number; // decimal odds from this API (nice!)
      }>;
    }>;
  }>;
};

/**
 * Our normalized shape (what ingest.ts expects)
 * - One entry per "event"
 * - Each contains an array of "lines" across different bookmakers
 */
export type NormalizedEvent = {
  league: string;       // e.g., "NBA"
  sport: string;        // e.g., "Basketball"
  startsAt: string;     // ISO string
  teamA: string;        // pick one side deterministically
  teamB: string;
  lines: Array<{
    book: string;       // e.g., "DraftKings"
    outcome: "A" | "B"; // which side these odds correspond to
    decimal: number;    // decimal odds
  }>;
};

function titleCase(input: string): string {
  return input
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Map sport_title from API → our two fields (sport + league).
 * We keep it simple: for "Basketball (NBA)" → sport="Basketball", league="NBA"
 */
function splitSportTitle(sportTitle: string): { sport: string; league: string } {
  // Examples: "Basketball" (generic) or "Basketball (NBA)"
  const m = sportTitle.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (m) {
    return { sport: m[1].trim(), league: m[2].trim() };
  }
  return { sport: sportTitle.trim(), league: sportTitle.trim() };
}

/**
 * Fetch raw data from The Odds API.
 * Docs: https://theoddsapi.com/
 *
 * NOTE: free plans have rate limits. Keep usage modest for MVP.
 */
export async function fetchTheOddsApi(options?: {
  apiKey?: string;
  sport?: string;
  region?: string;
  market?: string; // "h2h" for moneyline
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
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    // In production: handle 402/429 (quota/limit), 4xx errors, etc.
    const text = await res.text();
    throw new Error(`TheOddsAPI error ${res.status}: ${text}`);
  }

  const raw: RawOddsApiEvent[] = await res.json();

  // Normalize
  const normalized: NormalizedEvent[] = [];

  for (const ev of raw) {
    const { sport, league } = splitSportTitle(ev.sport_title || titleCase(ev.sport_key));

    // Decide which team is A vs B. We fix ordering for deterministic IDs/joins.
    // The API gives "home_team" and "away_team". We'll use away as teamA, home as teamB (arbitrary but consistent).
    const teamA = ev.away_team.trim();
    const teamB = ev.home_team.trim();

    const lines: NormalizedEvent["lines"] = [];

    for (const book of ev.bookmakers ?? []) {
      const ml = (book.markets ?? []).find((m) => m.key === "h2h");
      if (!ml) continue;

      // Outcomes come labeled by team name; we map them to "A" or "B" by comparing names.
      for (const out of ml.outcomes ?? []) {
        const name = (out.name || "").trim();

        if (name === teamA) {
          lines.push({ book: book.title || book.key, outcome: "A", decimal: out.price });
        } else if (name === teamB) {
          lines.push({ book: book.title || book.key, outcome: "B", decimal: out.price });
        } else {
          // ignore lines for unrelated names (sometimes APIs include draw or typo cases)
        }
      }
    }

    if (lines.length > 0) {
      normalized.push({
        league,
        sport,
        startsAt: ev.commence_time, // ISO
        teamA,
        teamB,
        lines,
      });
    }
  }

  return normalized;
}
