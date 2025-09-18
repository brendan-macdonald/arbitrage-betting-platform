/**
 * POST /api/refresh-odds
 *
 * This route triggers our "mock scraper" to update odds in the DB.
 * Your UI will call this endpoint when you click the "Refresh" button.
 *
 * Why POST?
 * - We're *changing* state (updating the database), so POST is the correct HTTP verb.
 */

import { NextResponse } from "next/server";
import { applyMockOddsDrift } from "@/lib/oddsUpdater";

export async function POST() {
  try {
    const { updated } = await applyMockOddsDrift();
    // 200 OK with a tiny payload the client can log if desired
    return NextResponse.json({ ok: true, updated });
  } catch (err) {
    console.error("refresh-odds error:", err);
    // 500 = "server had an error". In a production app, you'd structure this more.
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
