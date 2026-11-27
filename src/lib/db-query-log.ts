import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external.js";

// #92-E measurement: one structured line per database query, so the owner can
// count which route really reached the database (not just which function ran).
// The line carries the Next route pattern, model, operation and duration only:
// never query arguments, SQL parameters, cookies or any visitor data.
// Set DB_QUERY_LOG=0 to silence it.

export const DB_QUERY_LOG_PREFIX = "[db-query]";

export function dbQueryLogEnabled(env: Record<string, string | undefined> = process.env) {
  // Build-time prerender queries are not visitor traffic; keep build logs clean.
  return env.DB_QUERY_LOG !== "0" && env.NEXT_PHASE !== "phase-production-build";
}

function currentRoute(): string {
  try {
    // Next's shared request store; present for pages, route handlers, server
    // actions and unstable_cache fills. Absent in scripts and build steps.
    return workAsyncStorage.getStore()?.route ?? "(none)";
  } catch {
    return "(unknown)";
  }
}

export function dbQueryLine(entry: { route: string; model?: string; operation: string; ms: number; ok: boolean }) {
  return `${DB_QUERY_LOG_PREFIX} ${JSON.stringify({
    route: entry.route,
    model: entry.model ?? "$raw",
    op: entry.operation,
    ms: Math.round(entry.ms),
    ok: entry.ok,
  })}`;
}

/** Wraps one Prisma operation; used from the client's query extension. */
export async function logDbQuery<T>(model: string | undefined, operation: string, run: () => Promise<T>): Promise<T> {
  const route = currentRoute();
  const started = performance.now();
  let ok = false;
  try {
    const result = await run();
    ok = true;
    return result;
  } finally {
    console.log(dbQueryLine({ route, model, operation, ms: performance.now() - started, ok }));
  }
}
