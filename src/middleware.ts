import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// ---------------------------------------------------------------------------
// next-intl middleware for locale detection + redirect
// ---------------------------------------------------------------------------

const intlMiddleware = createIntlMiddleware(routing);

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
  match: (pathname: string, method: string) => boolean;
  limit: number;
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

function handleRateLimit(request: NextRequest): NextResponse | null {
  cleanup();

  const { pathname } = request.nextUrl;
  const method = request.method;

  const rule = resolveRule(pathname, method);
  if (!rule) return null;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    (request as any).ip ??
    "unknown";

  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + rule.windowMs });
    return null;
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
  return null;
}

// ---------------------------------------------------------------------------
// Combined middleware
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const rateLimitResponse = handleRateLimit(request);
    return rateLimitResponse || NextResponse.next();
  }

  // Skip i18n for non-public routes
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/spec") ||
    pathname.startsWith("/llms")
  ) {
    return NextResponse.next();
  }

  // i18n locale detection + redirect for public pages
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all paths except static files and _next
    "/((?!_next|.*\\..*).*)",
  ],
};
