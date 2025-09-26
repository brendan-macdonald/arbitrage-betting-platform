import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	// Build the same URL as your adapter
	const apiKey = process.env.ODDS_API_KEY!;

	const url = new URL("https://api.the-odds-api.com/v4/sports/baseball_mlb/odds");
	url.searchParams.set("regions", "us");
	url.searchParams.set("markets", "h2h,spreads,totals");
	url.searchParams.set("oddsFormat", "decimal");
	url.searchParams.set("dateFormat", "iso");
	url.searchParams.set("bookmakers", "mybookieag");
	url.searchParams.set("apiKey", apiKey);

	// Fetch the raw data
	const res = await fetch(url.toString());
	const raw = await res.json();

	// Find the event (either team can be home/away)
	const match = raw.find((ev: any) =>
		(ev.home_team?.toLowerCase().includes("yankees") && ev.away_team?.toLowerCase().includes("white sox")) ||
		(ev.home_team?.toLowerCase().includes("white sox") && ev.away_team?.toLowerCase().includes("yankees"))
	);

	return NextResponse.json({ match });
}
