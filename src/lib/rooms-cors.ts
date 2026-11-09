// No Node imports: middleware uses this too.
export const ROOM_ORIGINS = ["https://appai.info", "https://www.appai.info", "https://kycgrayson.github.io"];
type Env = Record<string, string | undefined>;

export function roomOriginAllowed(origin: string, env: Env) {
  const extra = (env.ROOMS_ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (ROOM_ORIGINS.includes(origin) || extra.includes(origin)) return true;
  if (env.NODE_ENV !== "production") return /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin);
  return false;
}
export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = { Vary: "Origin", "Cache-Control": "no-store" };
  if (origin && roomOriginAllowed(origin, env)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Expose-Headers"] = "Retry-After";
  }
  return headers;
}
// One limiter bucket per IP and room action, never per room code, so guessing codes cannot reset it.
export function roomRateBucket(pathname: string, method: string): string | null {
  if (!pathname.startsWith("/api/rooms")) return null;
  if (method === "OPTIONS") return "rooms:options";
  if (method === "GET") return "rooms:poll";
  if (pathname.endsWith("/join")) return "rooms:join";
  if (pathname.endsWith("/moves")) return "rooms:moves";
  if (pathname.endsWith("/start")) return "rooms:start";
  return "rooms:create";
}
