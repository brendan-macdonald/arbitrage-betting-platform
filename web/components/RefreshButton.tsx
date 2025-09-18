"use client";
/**
 * Why "use client"?
 * - Next.js App Router defaults to server components (good for data fetching/SSR).
 * - This file needs browser interactivity (onClick, fetch), so it must be a client component.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * A small button that:
 * - calls POST /api/refresh-odds
 * - then refreshes the server-rendered page (router.refresh)
 * - shows a loading state for UX clarity
 */
export function RefreshButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    try {
      setIsLoading(true);

      // 1) Call the API to update odds in DB
      const res = await fetch("/api/refresh-odds", { method: "POST" });
      // Optional: you could read the JSON { ok, updated } here and show a toast
      await res.json();

      // 2) Ask Next.js to refetch server data for this route
      router.refresh();
    } catch (e) {
      console.error("Failed to refresh odds:", e);
      // In a real app, show a toast or banner
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
        onClick={handleClick}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/60 px-5 py-2 text-sm shadow-sm backdrop-blur hover:bg-white/70 disabled:opacity-60 ring-1 ring-black/5 transition"
        >
        {isLoading ? "Refreshing..." : "Ingest odds"}
    </button>

  );
}
