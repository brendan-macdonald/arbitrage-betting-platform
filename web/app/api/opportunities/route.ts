/**
 * This is a Next.js "Route Handler" for the path /api/opportunities
 * - It runs on the server (Node.js), not in the browser
 * - It returns JSON with a list of arbitrage opportunities
 * - For MVP, we return STUB data from our in-memory function
 *
 * Why this is useful:
 * - Your UI can "fetch" from an API just like a real production app
 * - Later, we can swap the stub out for a real database without touching the UI
 */

import { NextResponse } from "next/server";
/**
 * We import our stub finder function from the "domain layer".
 * This keeps business logic separate from HTTP/API glue code.
 */
import { findStubOpportunities } from "@/lib/arbitrage";

/**
 * GET /api/opportunities
 * - No inputs for MVP
 * - Returns an array of opportunities
 */

export async function GET() {
    // 1) compute/find opportunities (currently: stubbed)
    const data = findStubOpportunities();

    // 2) send them back as JSON
    return NextResponse.json(data);
}