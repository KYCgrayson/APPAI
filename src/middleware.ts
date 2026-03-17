import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// In-memory rate limiter (per-IP, sliding window style with fixed buckets)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Route-specific rate limit rules
// ---------------------------------------------------------------------------

interface RateLimitRule {
  /** Matching function for the route */
  match: (pathname: string, method: string) => boolean;
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

const rules: RateLimitRule[] = [
  {
    match: (p) => p === "/api/v1/auth/register",
    limit: 5,
    windowMs: 60_000,
  },
  {
    match: (p) => p === "/api/v1/auth/device",
    limit: 10,
    windowMs: 60_000,
  },
  {
    match: (p) => p === "/api/v1/auth/token",
    limit: 30,
    windowMs: 60_000,
  },
  {
    match: (p) => p === "/api/auth/device/approve",
    limit: 10,
    windowMs: 60_000,
  },
  {
    match: (p, m) => p === "/api/v1/keys" && m === "POST",
    limit: 10,
    windowMs: 60_000,
  },
  {
    match: (p) => p.startsWith("/api/admin"),
    limit: 60,
    windowMs: 60_000,
  },
  {
    // Catch-all for any other API route
    match: (p) => p.startsWith("/api/"),
    limit: 60,
    windowMs: 60_000,
  },
];

function resolveRule(
  pathname: string,
  method: string
): RateLimitRule | undefined {
  return rules.find((r) => r.match(pathname, method));
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
  cleanup();

  const { pathname } = request.nextUrl;
  const method = request.method;

  const rule = resolveRule(pathname, method);
  if (!rule) {
    return NextResponse.next();
  }

  // Identify client by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    (request as any).ip ??
    "unknown";

  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    // First request in a new window
    rateLimitMap.set(key, { count: 1, resetTime: now + rule.windowMs });
    return NextResponse.next();
  }

  if (entry.count >= rule.limit) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      }
    );
  }

  entry.count += 1;
  return NextResponse.next();
}

// Only run middleware on API routes
export const config = {
  matcher: ["/api/:path*"],
};
