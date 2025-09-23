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
