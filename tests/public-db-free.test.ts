import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { ACCESS_REFRESH_SECONDS, refreshAccessToken, tokenAccess } from "../src/lib/auth-token.ts";

// Next installs this global in its runtime; its request store needs it.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external.js");
const { dbQueryLine, dbQueryLogEnabled, logDbQuery } = await import("../src/lib/db-query-log.ts");

// #92-E: public traffic must not reach the database.

function fakeStore(row: { organizationId: string | null; role: string } | null, fail = false) {
  const calls: string[] = [];
  const store = {
    user: {
      async findUnique() { calls.push("findUnique"); if (fail) throw new Error("db down"); return row; },
      async updateMany() { calls.push("updateMany"); if (fail) throw new Error("db down"); return { count: 1 }; },
    },
  };
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").filter(Boolean);
  return { calls, store, isAdminEmail: (email: string) => admins.includes(email) };
}

test("auth uses JWT sessions, so cookie-less visitors never reach the Session table", () => {
  const source = readFileSync("src/lib/auth.ts", "utf8");
  assert.match(source, /session: \{ strategy: "jwt" \}/);
  assert.doesNotMatch(source, /db\.user\.findUnique/, "the session callback must read claims from the token");
});

test("sign-in loads organization and role into the token", async () => {
  const store = fakeStore({ organizationId: "org-1", role: "USER" });
  const token = await refreshAccessToken({}, { id: "user-1", email: "someone@example.test" }, store, 1000);
  assert.deepEqual(token, { sub: "user-1", organizationId: "org-1", role: "USER", accessCheckedAt: 1000 });
  assert.deepEqual(store.calls, ["findUnique"]);
  assert.deepEqual(tokenAccess(token!), { organizationId: "org-1", role: "USER" });
});

test("sign-in promotes configured admin emails before the claims are read", async () => {
  const previous = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "boss@example.test";
  try {
    const store = fakeStore({ organizationId: "org-1", role: "ADMIN" });
    const token = await refreshAccessToken<{ sub?: string; role?: string }>({}, { id: "user-1", email: "boss@example.test" }, store, 1000);
    assert.deepEqual(store.calls, ["updateMany", "findUnique"]);
    assert.equal(token?.role, "ADMIN");
  } finally {
    if (previous === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = previous;
  }
});

test("a fresh token is served without any database read", async () => {
  const store = fakeStore({ organizationId: "org-2", role: "ADMIN" });
  const token = { sub: "user-1", organizationId: "org-1", role: "USER", accessCheckedAt: 1000 };
  const result = await refreshAccessToken(token, undefined, store, 1000 + ACCESS_REFRESH_SECONDS - 1);
  assert.equal(result?.role, "USER");
  assert.deepEqual(store.calls, []);
});

test("a stale token re-reads claims once; a deleted user is signed out", async () => {
  const store = fakeStore({ organizationId: "org-2", role: "ADMIN" });
  const stale = { sub: "user-1", organizationId: "org-1", role: "USER", accessCheckedAt: 1000 };
  const refreshed = await refreshAccessToken({ ...stale }, undefined, store, 1000 + ACCESS_REFRESH_SECONDS);
  assert.deepEqual(refreshed, { sub: "user-1", organizationId: "org-2", role: "ADMIN", accessCheckedAt: 1000 + ACCESS_REFRESH_SECONDS });
  assert.equal(await refreshAccessToken({ ...stale }, undefined, fakeStore(null), 1000 + ACCESS_REFRESH_SECONDS), null);
  assert.equal(await refreshAccessToken({}, undefined, fakeStore(null), 1000), null, "a token without a subject is not a session");
});

test("a warm instance shares one claims read across stale cookies", async () => {
  const store = fakeStore({ organizationId: "org-2", role: "ADMIN" });
  const deps = { ...store, memo: new Map() };
  const stale = () => ({ sub: "user-1", organizationId: "org-1", role: "USER", accessCheckedAt: 0 });
  const t = 10_000;
  assert.equal((await refreshAccessToken(stale(), undefined, deps, t))?.role, "ADMIN");
  assert.equal((await refreshAccessToken(stale(), undefined, deps, t + 60))?.role, "ADMIN");
  assert.deepEqual(store.calls, ["findUnique"], "second server-side auth() reuses the memo");
  await refreshAccessToken(stale(), undefined, deps, t + ACCESS_REFRESH_SECONDS);
  assert.deepEqual(store.calls, ["findUnique", "findUnique"], "the memo expires with the same window");
});

test("a database outage keeps an existing session but fails a new sign-in", async () => {
  const stale = { sub: "user-1", organizationId: "org-1", role: "USER", accessCheckedAt: 0 };
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await refreshAccessToken({ ...stale }, undefined, fakeStore(null, true), 10_000), stale);
  } finally { console.error = originalError; }
  await assert.rejects(refreshAccessToken({}, { id: "user-1", email: null }, fakeStore(null, true), 10_000));
});

test("tokens without claims fall back like a missing database user", () => {
  assert.equal(tokenAccess({ sub: "user-1" }), null);
  assert.deepEqual(tokenAccess({ role: "USER", organizationId: 5 as unknown as string }), { organizationId: null, role: "USER" });
});

test("query log lines carry route, model, operation and duration only", async () => {
  assert.equal(dbQueryLogEnabled({}), true);
  assert.equal(dbQueryLogEnabled({ DB_QUERY_LOG: "0" }), false);
  assert.equal(dbQueryLogEnabled({ NEXT_PHASE: "phase-production-build" }), false);
  assert.equal(dbQueryLine({ route: "/p/[...segments]", model: "HostedPage", operation: "findFirst", ms: 3.6, ok: true }),
    '[db-query] {"route":"/p/[...segments]","model":"HostedPage","op":"findFirst","ms":4,"ok":true}');
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (line: string) => { lines.push(line); };
  try {
    const store = { route: "/[locale]/login" } as Parameters<typeof workAsyncStorage.run>[0];
    const value = await workAsyncStorage.run(store, () => logDbQuery("User", "findUnique", async () => ({ secret: "x" })));
    assert.deepEqual(value, { secret: "x" });
    await assert.rejects(logDbQuery(undefined, "$queryRaw", async () => { throw new Error("boom"); }));
  } finally { console.log = originalLog; }
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0].slice("[db-query] ".length)), { route: "/[locale]/login", model: "User", op: "findUnique", ms: JSON.parse(lines[0].slice(11)).ms, ok: true });
  assert.doesNotMatch(lines.join("\n"), /secret/);
  assert.deepEqual({ ...JSON.parse(lines[1].slice(11)), ms: 0 }, { route: "(none)", model: "$raw", op: "$queryRaw", ms: 0, ok: false });
});

test("public pages refresh on publish, with only a one-day safety timer", () => {
  for (const path of ["(site)/[locale]/page.tsx", "(site)/[locale]/apps/page.tsx", "(site)/[locale]/apps/native/page.tsx",
    "(site)/[locale]/tools/page.tsx", "(site)/[locale]/websites/page.tsx",
    "(site)/[locale]/directory-filtered/[section]/[filter]/page.tsx", "llms.txt/route.ts"]) {
    assert.match(readFileSync(`src/app/${path}`, "utf8"), /export const revalidate = 86400;/, path);
  }
  assert.match(readFileSync("src/lib/public-directory.ts", "utf8"), /revalidate: 86400, tags: \["public-directory"\]/);
  assert.match(readFileSync("src/lib/sitemap-data.ts", "utf8"), /revalidate: 86400, tags: \["seo-sitemap"\]/);
  assert.match(readFileSync("src/lib/revalidate-seo.ts", "utf8"), /"\/llms\.txt"/);
});
