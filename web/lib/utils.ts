// Returns a human-readable time difference (e.g., "just now", "2m ago", "1h 4m ago"). Returns "—" if input is falsy or invalid.
export function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!(date instanceof Date) || isNaN(date.getTime())) return "—";
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "—";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  if (hr < 24) return remMin > 0 ? `${hr}h ${remMin}m ago` : `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return d === 1 ? "1d ago" : `${d}d ago`;
}
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseCSV(q?: string): string[] {
  if (!q) return [];
  return Array.from(new Set(q.split(",").map((s) => s.trim()).filter(Boolean)));
}

export function coerceNumber(q: string | null | undefined, def: number): number {
  const n = Number(q);
  return isFinite(n) ? n : def;
}
