import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { STATIC_GAME_PATH_SEGMENTS } from "@/lib/games-catalog";
import { corsHeaders, roomRateBucket, leaderboardRateBucket, roomOriginAllowed } from "@/lib/rooms-cors";

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
  { match: (p, m) => m === "GET" && p.startsWith("/api/games/"), limit: 300, windowMs: 60_000 },
  { match: (p) => p === "/api/feedback/web", limit: 5, windowMs: 3600000 },
  { match: (p) => p === "/api/v1/feedback", limit: 20, windowMs: 3600000 },
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
    match: (p) => (p === "/api/auth/device/approve" || p === "/api/auth/device/deny"),
    limit: 10,
    windowMs: 60_000,
  },
  {
    match: (p) => p === "/api/auth/device/lookup",
    limit: 20,
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
    // Room polling runs about once a second per device, and up to four devices can share one home IP.
    // Room keys are per IP and action (see roomRateBucket), not per room code.
    match: (p, m) => m === "GET" && p.startsWith("/api/rooms/"),
    limit: 600,
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

  // Room preflights do no database work, and a 429 on a preflight would surface as an opaque CORS error.
  if (method === "OPTIONS" && (pathname.startsWith("/api/rooms") || pathname.startsWith("/api/games/"))) return null;

  const rule = resolveRule(pathname, method);
  if (!rule) return null;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const key = `${ip}:${roomRateBucket(pathname, method) ?? leaderboardRateBucket(pathname, method) ?? pathname}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + rule.windowMs });
    return null;
  }

  if (entry.count >= rule.limit) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          // Browser games on other origins must be able to read this 429 to back off.
          ...((pathname.startsWith("/api/rooms") || pathname.startsWith("/api/games/")) ? corsHeaders(request, process.env) : {}),
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
  const requestHeaders = new Headers(request.headers);
  for (const name of [...requestHeaders.keys()]) {
    if (name.startsWith("x-appai-hosted-")) requestHeaders.delete(name);
  }
  request = new NextRequest(request, { headers: requestHeaders });
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/games/")) {
    const origin = request.headers.get("origin");
    if (origin && !roomOriginAllowed(origin, process.env)) return NextResponse.json(
      { error: "origin_not_allowed", message: "This origin may not use leaderboards" },
      { status: 403, headers: corsHeaders(request, process.env) }
    );
  }

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const rateLimitResponse = handleRateLimit(request);
    return rateLimitResponse || NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Preserve the exact protected native-app path so the server layout can
  // return unauthenticated users to the requested module after login.
  if (pathname.startsWith("/app/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-appai-request-path", `${pathname}${request.nextUrl.search}`);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname.startsWith("/p/")) {
    const requestHeaders = new Headers(request.headers);
    // Always overwrite visitor-supplied headers; hosted locales are independent of next-intl.
    requestHeaders.set("x-appai-hosted-path", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Own static game builds and covers under public/games/ are locale-free files;
  // the /games hub and other game slugs go through next-intl.
  if (
    pathname.startsWith("/games/") &&
    STATIC_GAME_PATH_SEGMENTS.includes(pathname.split("/")[2])
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Skip i18n for non-public routes
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/spec") ||
    pathname.startsWith("/llms")
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // i18n locale detection + redirect for public pages
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // A spoofed hosted header on an excluded dotted path only affects the requester's own response.
    "/((?!_next|.*\\..*).*)",
  ],
};
