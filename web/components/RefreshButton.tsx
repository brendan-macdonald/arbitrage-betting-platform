"use client";
/**
 * Client component:
 * - Next.js App Router defaults to server components
 * - This file needs browser interactivity (onClick, fetch)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * A button that:
 * - calls POST /api/ingest-odds (with sport/region/market params)
 * - then refreshes the server-rendered page
 * - shows a loading state
 */
export function RefreshButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    try {
      setIsLoading(true);

      // 1) Call the ingest API (this replaces the old /api/refresh-odds mock)
      const res = await fetch(
        "/api/ingest-odds?sport=americanfootball_ncaaf&region=us&market=h2h",
        { method: "POST" }
      );

      if (!res.ok) {
        throw new Error(`Ingest failed: ${res.status}`);
      }

      // Optional: inspect response (how many events/odds updated)
      const data = await res.json();
      console.log("Ingest result:", data);

      // 2) Refresh the page so new odds show up in /api/opportunities
      router.refresh();
    } catch (e) {
      console.error("Failed to ingest odds:", e);
      // In a real app, show a toast/banner
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/80 px-5 py-2 text-sm shadow-sm backdrop-blur hover:bg-white/90 disabled:opacity-60 ring-1 ring-black/5 transition"
    >
      {isLoading ? "Refreshing..." : "Ingest odds"}
    </button>
  );
}
