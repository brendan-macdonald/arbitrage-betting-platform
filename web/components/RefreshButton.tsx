"use client";
/**
 * Client component:
 * - Next.js App Router defaults to server components
 * - This file needs browser interactivity (onClick, fetch)
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * A button that:
 * - calls POST /api/ingest-odds (with sport/region/market params)
 * - then refreshes the server-rendered page
 * - shows a loading state
 */
export function RefreshButton() {
  const router = useRouter();
  const sp = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [toast, setToast] = useState("");

  // Get current sport/region/market from search params or defaults
  const sport = sp.get("sport") || "americanfootball_ncaaf";
  const region = sp.get("region") || "us";
  const market = sp.get("market") || "h2h";

  async function handleClick() {
    try {
      setIsLoading(true);
      setDisabled(true);
      setTimeout(() => setDisabled(false), 10000); // Disable for 10s after click
      // Use current filter values for ingest
      const url = `/api/ingest-odds?sport=${encodeURIComponent(
        sport
      )}&region=${encodeURIComponent(region)}&market=${encodeURIComponent(market)}`;
      const res = await fetch(url, { method: "POST" });
      if (res.status === 429) {
        setToast("Too many refreshes, try again in a few seconds.");
        setTimeout(() => setToast(""), 4000);
        return;
      }
      if (!res.ok) {
        throw new Error(`Ingest failed: ${res.status}`);
      }
      const data = await res.json();
      console.log("Ingest result:", data);
      router.refresh();
    } catch (e) {
      console.error("Failed to ingest odds:", e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isLoading || disabled}
        className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/80 px-5 py-2 text-sm shadow-sm backdrop-blur hover:bg-white/90 disabled:opacity-60 ring-1 ring-black/5 transition"
      >
        {isLoading ? "Refreshing..." : "Ingest odds"}
      </button>
      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-red-100 text-red-700 text-xs rounded shadow">
          {toast}
        </div>
      )}
    </div>
  );
}
