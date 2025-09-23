// middleware.ts
// Tiny in-memory token-bucket rate limiter for Next.js API routes
// Usage: Place this in your /web directory. It will run for all API routes.
// - /api/opportunities: 30 req/min per IP
// - /api/ingest-odds: 1 req/15s per IP
// - Skips rate limit in dev (NODE_ENV !== 'production')
// - Returns { ok: false, error: 'rate_limited' } with 429 if limited

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isProd = process.env.NODE_ENV === 'production';
const buckets: Record<string, { count: number; ts: number }> = {};

function getKey(req: NextRequest, limit: number, windowMs: number) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const path = req.nextUrl.pathname;
  return `${ip}:${path}:${limit}:${windowMs}`;
}

export function middleware(req: NextRequest) {
  if (!isProd) return NextResponse.next();
  let limit = 30, windowMs = 60_000;
  if (req.nextUrl.pathname.startsWith('/api/ingest-odds')) {
    limit = 1; windowMs = 15_000;
  } else if (req.nextUrl.pathname.startsWith('/api/opportunities')) {
    limit = 30; windowMs = 60_000;
  } else {
    return NextResponse.next();
  }
  const key = getKey(req, limit, windowMs);
  const now = Date.now();
  const bucket = buckets[key] || { count: 0, ts: now };
  if (now - bucket.ts > windowMs) {
    bucket.count = 0;
    bucket.ts = now;
  }
  if (bucket.count >= limit) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }
  bucket.count++;
  buckets[key] = bucket;
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/opportunities', '/api/ingest-odds'],
};
