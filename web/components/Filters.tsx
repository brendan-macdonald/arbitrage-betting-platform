"use client";
// Filters component: multi-select for sports, markets, bookmakers, and ROI slider.
// - Persists filters to localStorage and URL.
// - Debounced change handler to avoid excessive refresh.
// - Contract: Only updates parent on valid filter changes.

import React, { useEffect, useRef, useState } from "react";
import { SPORTS, SPORT_DISPLAY_NAMES } from "@/lib/oddsAdapters/sports";

const MARKET_OPTIONS = [
  { value: "h2h", label: "Moneyline (H2H)" },
  { value: "spread", label: "Point Spread" },
  { value: "totals", label: "Totals" },
];

function persist({
  sports,
  markets,
  minRoi,
  bookmakers,
}: {
  sports: string[];
  markets: string[];
  minRoi: number;
  bookmakers: string[];
}) {
  // Save filter state to localStorage
  localStorage.setItem("prefs.sports", JSON.stringify(sports));
  localStorage.setItem("prefs.markets", JSON.stringify(markets));
  localStorage.setItem("prefs.minRoi", String(minRoi));
  localStorage.setItem("prefs.bookmakers", JSON.stringify(bookmakers));
}

function syncUrl({
  sports,
  markets,
  minRoi,
  bookmakers,
}: {
  sports: string[];
  markets: string[];
  minRoi: number;
  bookmakers: string[];
}) {
  // Sync filter state to URL params
  const params = new URLSearchParams();
  if (sports.length) params.set("sports", sports.join(","));
  if (markets.length) params.set("markets", markets.join(","));
  if (bookmakers.length) params.set("bookmakers", bookmakers.join(","));
  params.set("minRoi", minRoi.toString());
  window.history.replaceState({}, "", `?${params}`);
}

function DropdownMulti({
  options,
  values,
  onChange,
  label,
}: {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  label: string;
}) {
  // Custom multi-select dropdown with search and select-all
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);
  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 rounded-lg border bg-white shadow-sm text-sm flex items-center gap-2 min-w-[180px]"
      >
        {values.length ? `${values.length} selected` : `Select ${label}`}
        <svg className="w-4 h-4 ml-1" viewBox="0 0 20 20">
          <path
            d="M7 7l3-3 3 3m0 6l-3 3-3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute z-10 mt-2 w-72 max-h-80 overflow-auto rounded-xl border bg-white shadow-lg p-3">
          <input
            type="text"
            placeholder={`Search ${label}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mb-2 px-2 py-1 rounded border text-sm"
          />
          <div className="flex items-center mb-2 gap-2">
            <button
              type="button"
              className="text-xs underline"
              onClick={() => onChange(options.map((o) => o.value))}
            >
              Select All
            </button>
            <button
              type="button"
              className="text-xs underline"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {filtered.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-blue-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={values.includes(opt.value)}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...values, opt.value]);
                    else onChange(values.filter((v) => v !== opt.value));
                  }}
                  className="accent-blue-500"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Filters({
  onChange,
}: {
  onChange?: (v: {
    sports: string[];
    markets: string[];
    minRoi: number;
    bookmakers: string[];
  }) => void;
} = {}) {
  const [sports, setSports] = useState<string[]>([]);
  const [markets, setMarkets] = useState<string[]>(["h2h"]);
  const [minRoi, setMinRoi] = useState<number>(1.0);
  const [bookmakers, setBookmakers] = useState<string[]>([]);
  const [bookOptions, setBookOptions] = useState<string[]>([]);

  // Debounce refresh to avoid excessive updates
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  function debouncedChange(next: {
    sports?: string[];
    markets?: string[];
    minRoi?: number;
    bookmakers?: string[];
  }) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleChange(next);
    }, 400);
  }

  useEffect(() => {
    // Load initial filter state from localStorage and API
    fetch("/api/opportunities?freshMins=10080")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.bookmakers) setBookOptions(data.bookmakers);
      });
    const s = JSON.parse(localStorage.getItem("prefs.sports") || "[]");
    const m = JSON.parse(localStorage.getItem("prefs.markets") || '["h2h"]');
    const r = Number(localStorage.getItem("prefs.minRoi") || 1.0);
    const b = JSON.parse(localStorage.getItem("prefs.bookmakers") || "[]");
    setSports(s);
    setMarkets(m);
    setMinRoi(r);
    setBookmakers(b);
    syncUrl({ sports: s, markets: m, minRoi: r, bookmakers: b });
    onChange?.({ sports: s, markets: m, minRoi: r, bookmakers: b });
    // eslint-disable-next-line
  }, []);

  function handleChange(next: {
    sports?: string[];
    markets?: string[];
    minRoi?: number;
    bookmakers?: string[];
  }) {
    const s = next.sports ?? sports;
    const m = next.markets ?? markets;
    const r = next.minRoi ?? minRoi;
    const b = next.bookmakers ?? bookmakers;
    setSports(s);
    setMarkets(m);
    setMinRoi(r);
    setBookmakers(b);
    persist({ sports: s, markets: m, minRoi: r, bookmakers: b });
    syncUrl({ sports: s, markets: m, minRoi: r, bookmakers: b });
    onChange?.({ sports: s, markets: m, minRoi: r, bookmakers: b });
  }

  return (
    <div className="flex flex-wrap items-center gap-4 p-2 bg-white/70 rounded-xl shadow-sm">
      <div>
        <span className="text-xs text-muted-foreground mr-2">Bookmakers</span>
        <DropdownMulti
          options={bookOptions.map((b) => ({ value: b, label: b }))}
          values={bookmakers}
          onChange={(v) => debouncedChange({ bookmakers: v })}
          label="bookmakers"
        />
      </div>
      <div>
        <span className="text-xs text-muted-foreground mr-2">Sports</span>
        <DropdownMulti
          options={SPORTS.map((s) => ({
            value: s,
            label: SPORT_DISPLAY_NAMES[s] || s,
          }))}
          values={sports}
          onChange={(v) => debouncedChange({ sports: v })}
          label="sports"
        />
      </div>
      <div>
        <span className="text-xs text-muted-foreground mr-2">Markets</span>
        <DropdownMulti
          options={MARKET_OPTIONS}
          values={markets}
          onChange={(v) => debouncedChange({ markets: v })}
          label="markets"
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        ROI ≥ <span className="font-semibold">{minRoi.toFixed(2)}%</span>
        <input
          type="range"
          min={0.01}
          max={5.0}
          step={0.01}
          value={minRoi}
          onChange={(e) => debouncedChange({ minRoi: Number(e.target.value) })}
          className="accent-blue-500 w-28"
        />
      </label>
    </div>
  );
}
