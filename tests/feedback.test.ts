import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { saveWebFeedback, webFeedbackAvailable, loadAdminFeedback, submitFeedback, selectFeedbackContact, feedbackSchema, verifyTurnstile, notifyFeedback, feedbackIpHash, type FeedbackDeps, type FeedbackData } from "../src/lib/feedback.ts";

const valid = { kind: "missing_feature", message: "Please add a useful capability" };
const identity = { apiKeyId: "key", organizationId: "org", userId: "user", contactEmail: "owner@example.test" };
function fake() {
  const saved: FeedbackData[] = [];
  let notifications = 0;
  const deps: FeedbackDeps = {
    env: {}, authenticate: async header => header === "Bearer test" ? identity : null,
    save: async data => { saved.push(data); return { id: "feedback-id" }; },
    notify: async () => { notifications++; },
  };
  return { deps, saved, notifications: () => notifications };
}
function request(body: unknown, authorized = true) {
  return new Request("https://example.test/api/v1/feedback", { method: "POST", headers: { "Content-Type": "application/json", ...(authorized ? { authorization: "Bearer test" } : {}) }, body: JSON.stringify(body) });
}
test("feedback validates kind, message boundaries and optional URLs", () => {
  assert.equal(feedbackSchema.safeParse(valid).success, true);
  for (const body of [{ ...valid, kind: "wrong" }, { ...valid, message: "short" }, { ...valid, message: "a".repeat(4001) }, { ...valid, specUrl: "javascript:alert(1)" }, { ...valid, pageSlug: 5 }]) assert.equal(feedbackSchema.safeParse(body).success, false);
  for (const length of [10, 4000]) assert.equal(feedbackSchema.safeParse({ ...valid, message: "a".repeat(length) }).success, true);
});
test("agent requires key and returns 401 without writing", async () => {
  const f = fake();
  assert.equal((await submitFeedback(request(valid, false), "agent", f.deps)).status, 401);
  assert.equal(f.saved.length, 0);
});
test("quota returns 429 without notification", async () => {
  const f = fake(); f.deps.save = async () => null;
  assert.equal((await submitFeedback(request(valid), "agent", f.deps)).status, 429);
  assert.equal(f.notifications(), 0);
});
test("agent ignores body email and attribution; response never echoes email", async () => {
  const f = fake();
  const response = await submitFeedback(request({ ...valid, contactEmail: "spoof@example.test", userId: "spoof", apiKeyId: "spoof" }), "agent", f.deps);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: "feedback-id" });
  assert.equal(f.saved[0].contactEmail, identity.contactEmail);
  assert.equal(f.saved[0].apiKeyId, identity.apiKeyId);
  assert.equal(f.saved[0].userId, identity.userId);
});
test("honeypot pretends success without storage, verification or notification", async () => {
  const f = fake(); f.deps.env = { TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" };
  const response = await submitFeedback(request({ website: "spam" }, false), "web", f.deps);
  assert.equal(response.status, 201); assert.equal(f.saved.length, 0); assert.equal(f.notifications(), 0);
});
test("web validates email, rejects malformed JSON and invalid submissions", async () => {
  const f = fake();
  for (const contactEmail of [undefined, "bad", ""]) assert.equal((await submitFeedback(request({ ...valid, contactEmail }), "web", f.deps)).status, 400);
  assert.equal((await submitFeedback(request({ ...valid, message: "short" }), "agent", f.deps)).status, 400);
  const broken = new Request("https://example.test", { method: "POST", body: "{" });
  assert.equal((await submitFeedback(broken, "web", f.deps)).status, 400);
  assert.equal(f.saved.length, 0);
});
test("Turnstile skips when unset or partially set; configured verification fails closed", async () => {
  const never: typeof fetch = async () => { throw Error("must not fetch"); };
  assert.equal(await verifyTurnstile(undefined, {}, never), true);
  assert.equal(await verifyTurnstile(undefined, { TURNSTILE_SITE_KEY: "site" }, never), true);
  const env = { TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" };
  assert.equal(await verifyTurnstile(undefined, env, never), false);
  assert.equal(await verifyTurnstile("token", env, never), false);
  let calls = 0;
  const send: typeof fetch = async (url, init) => {
    calls++; assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal((init!.body as URLSearchParams).get("secret"), "secret");
    return Response.json({ success: true });
  };
  assert.equal(await verifyTurnstile("token", env, send), true); assert.equal(calls, 1);
  const f = fake(); f.deps.env = env;
  assert.equal((await submitFeedback(request({ ...valid, contactEmail: "human@example.test" }), "web", f.deps)).status, 400);
  assert.equal(f.saved.length, 0);
});
test("web stores email and page URL, skipping Turnstile when unset", async () => {
  const f = fake(); f.deps.fetch = async () => { throw Error("unexpected verification"); };
  assert.equal((await submitFeedback(request({ ...valid, contactEmail: "human@example.test", pageUrl: "https://example.test/page" }), "web", f.deps)).status, 201);
  assert.equal(f.saved[0].contactEmail, "human@example.test"); assert.equal(f.saved[0].pageSlug, "https://example.test/page");
});
test("IP hash omitted without salt, salted and deterministic otherwise", () => {
  assert.equal(feedbackIpHash("test-ip", {}), undefined);
  assert.equal(feedbackIpHash("test-ip", { FEEDBACK_IP_SALT: "salt" }), feedbackIpHash("test-ip", { FEEDBACK_IP_SALT: "salt" }));
  assert.notEqual(feedbackIpHash("test-ip", { FEEDBACK_IP_SALT: "salt" }), feedbackIpHash("test-ip", { FEEDBACK_IP_SALT: "other" }));
});
test("notification skips when unset and sends plain text with trusted reply-to when configured", async () => {
  const data: FeedbackData = { ...valid, kind: "missing_feature", source: "agent", contactEmail: identity.contactEmail };
  let calls = 0;
  const send: typeof fetch = async (_url, init) => {
    calls++; const body = JSON.parse(init!.body as string);
    assert.equal(body.reply_to, identity.contactEmail); assert.ok(body.text.includes(valid.message)); assert.equal(body.html, undefined);
    return Response.json({ id: "mail-id" });
  };
  await notifyFeedback(data, {}, send); assert.equal(calls, 0);
  await notifyFeedback(data, { FEEDBACK_NOTIFY_EMAIL: "notify@example.test", RESEND_API_KEY: "test", APPAI_EMAIL_FROM: "sender@example.test" }, send);
  assert.equal(calls, 1);
});
test("routes use shared handler; quota is counted in a key-locked transaction; middleware limits both paths", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  assert.match(read("../src/app/api/v1/feedback/route.ts"), /submitFeedback\(request, "agent", feedbackDeps\)/);
  assert.match(read("../src/app/api/feedback/web/route.ts"), /submitFeedback\(request, "web", feedbackDeps\)/);
  const server = read("../src/lib/feedback-server.ts");
  assert.match(server, /validateApiKey\(header\)/); assert.match(server, /FOR UPDATE/); assert.match(server, /tx.feedback.count/); assert.match(server, /count >= 20/);
  assert.match(read("../src/middleware.ts"), /\/api\/feedback\/web", limit: 5, windowMs: 3600000/);
  assert.match(read("../src/middleware.ts"), /\/api\/v1\/feedback", limit: 20/);
});

test("organization contact uses sole user, earliest admin, then earliest user", () => {
  const user = (id: string, role: string, day: number) => ({ id, role, email: `${id}@example.test`, createdAt: new Date(2026, 0, day) });
  const early = user("early", "USER", 1);
  const admin = user("admin", "ADMIN", 2);
  const laterAdmin = user("later", "ADMIN", 3);
  assert.equal(selectFeedbackContact([early]), early);
  assert.equal(selectFeedbackContact([laterAdmin, early, admin]), admin);
  assert.equal(selectFeedbackContact([user("late", "USER", 4), early]), early);
  assert.equal(selectFeedbackContact([]), undefined);
  assert.equal(selectFeedbackContact([{ ...admin, email: null }, early])?.email, null);
});
test("missing Feedback table returns 503 for agent and web without notification", async () => {
  for (const source of ["agent", "web"] as const) {
    const f = fake();
    f.deps.save = async () => { throw Object.assign(new Error("Table does not exist"), { code: "P2021" }); };
    const response = await submitFeedback(request({ ...valid, contactEmail: "human@example.test" }), source, f.deps);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Feedback is not available yet" });
    assert.equal(f.notifications(), 0);
  }
});
test("other storage errors are not reported as missing table", async () => {
  const f = fake();
  const error = Object.assign(new Error("Storage failure"), { code: "P2002" });
  f.deps.save = async () => { throw error; };
  await assert.rejects(submitFeedback(request(valid), "agent", f.deps), error);
});
test("migration only creates Feedback and page renders independently of storage", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const migration = read("../prisma/feedback-migration.sql");
  assert.match(migration, /CREATE TABLE "Feedback"/);
  assert.doesNotMatch(migration, /ALTER|UPDATE|INSERT|DELETE|DROP/i);
  const page = read("../src/app/[locale]/feedback/page.tsx");
  assert.match(page, /<FeedbackForm/);
  assert.doesNotMatch(page, /\bdb\b|feedback-server/);
  const schema = read("../prisma/schema.prisma");
  assert.doesNotMatch(schema.match(/model ApiKey \{[^}]+\}/)![0], /userId|\buser\b/);
  const server = read("../src/lib/feedback-server.ts");
  assert.match(server, /keyHash: hashApiKey/);
  assert.match(server, /where: \{ organizationId: key.organizationId \}/);
  assert.match(server, /selectFeedbackContact\(users\)/);
});

test("organization contact uses the sole user, earliest admin, or earliest user", () => {
  const user = (id: string, role: string, day: number) => ({ id, role, email: `${id}@example.test`, createdAt: new Date(2026, 0, day) });
  const first = user("first", "MEMBER", 1);
  const admin = user("admin", "ADMIN", 2);
  const laterAdmin = user("later", "ADMIN", 3);
  assert.equal(selectFeedbackContact([first]), first);
  assert.equal(selectFeedbackContact([laterAdmin, first, admin]), admin);
  assert.equal(selectFeedbackContact([user("later", "MEMBER", 3), first]), first);
  assert.equal(selectFeedbackContact([]), undefined);
});

test("missing Feedback table returns 503 for agent and web without notifying", async () => {
  for (const source of ["agent", "web"] as const) {
    const f = fake();
    f.deps.save = async () => { throw Object.assign(new Error("Missing table"), { code: "P2021" }); };
    const response = await submitFeedback(request({ ...valid, contactEmail: "human@example.test" }), source, f.deps);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Feedback is not available yet" });
    assert.equal(f.notifications(), 0);
  }
});

test("unrelated storage failures are not reported as a missing table", async () => {
  const f = fake();
  const failure = Object.assign(new Error("Unavailable"), { code: "P1001" });
  f.deps.save = async () => { throw failure; };
  await assert.rejects(submitFeedback(request(valid), "agent", f.deps), failure);
  assert.equal(f.notifications(), 0);
});

test("feedback deployment adds only its own table and page rendering has no database dependency", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const migration = read("../prisma/feedback-migration.sql");
  assert.match(migration, /CREATE TABLE "Feedback"/);
  assert.doesNotMatch(migration, /\b(ALTER|UPDATE|INSERT|DELETE|DROP)\b/i);
  const page = read("../src/app/[locale]/feedback/page.tsx");
  assert.doesNotMatch(page, /feedback-server|@\/lib\/db|db\./);
});

test("production web form fails closed for either missing Turnstile key; agent API remains available", async () => {
  for (const keys of [{}, { TURNSTILE_SITE_KEY: "site" }, { TURNSTILE_SECRET_KEY: "secret" }]) {
    const f = fake(); f.deps.env = { NODE_ENV: "production", ...keys };
    assert.equal(webFeedbackAvailable(f.deps.env), false);
    assert.equal((await submitFeedback(request({ ...valid, website: "spam" }), "web", f.deps)).status, 503);
    assert.equal(f.saved.length, 0);
    assert.equal((await submitFeedback(request(valid), "agent", f.deps)).status, 201);
    assert.equal(await verifyTurnstile(undefined, f.deps.env), false);
  }
  const f = fake(); f.deps.env = { NODE_ENV: "production", TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" };
  f.deps.fetch = async () => Response.json({ success: true });
  assert.equal(webFeedbackAvailable(f.deps.env), true);
  assert.equal((await submitFeedback(request({ ...valid, contactEmail: "human@example.test", turnstileToken: "token" }), "web", f.deps)).status, 201);
});

test("both endpoints enforce declared and streamed byte limits before JSON parsing", async () => {
  for (const source of ["agent", "web"] as const) {
    for (const declared of [undefined, "1", "16385"]) {
      const f = fake(); let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) { controller.enqueue(new Uint8Array(8193).fill(32)); },
        cancel() { cancelled = true; },
      });
      const req = new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer test", ...(declared ? { "content-length": declared } : {}) }, body, duplex: "half" } as RequestInit);
      assert.equal((await submitFeedback(req, source, f.deps)).status, 413);
      if (declared !== "16385") assert.equal(cancelled, true);
      assert.equal(f.saved.length, 0); assert.equal(f.notifications(), 0);
    }
    const f = fake();
    const json = JSON.stringify({ ...valid, contactEmail: "human@example.test" });
    const req = new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer test" }, body: json.padEnd(16384, " ") });
    assert.equal((await submitFeedback(req, source, f.deps)).status, 201);
    assert.equal((await submitFeedback(request({ ...valid, padding: "界".repeat(6000) }), source, f.deps)).status, 413);
  }
});

test("admin missing-table loader returns notice state and propagates other failures", async () => {
  assert.equal(await loadAdminFeedback(async () => { throw { code: "P2021" }; }), null);
  assert.deepEqual(await loadAdminFeedback(async () => []), []);
  const error = Object.assign(new Error("failure"), { code: "P1001" });
  await assert.rejects(loadAdminFeedback(async () => { throw error; }), error);
  const page = readFileSync(new URL("../src/app/admin/feedback/page.tsx", import.meta.url), "utf8");
  assert.match(page, /loadAdminFeedback\(/);
  assert.match(page, /Feedback table not created yet/);
});

test("web global quota counts only web rows in rolling day under database transaction lock", async () => {
  const server = readFileSync(new URL("../src/lib/feedback-server.ts", import.meta.url), "utf8");
  assert.match(server, /source === "web"\) return db\.\$transaction/);
  assert.match(server, /pg_advisory_xact_lock/);
  assert.match(server, /source: "web", createdAt: \{ gte: since/);
  for (const count of [199, 200, 201]) {
    const events: string[] = [];
    const before = Date.now();
    const result = await saveWebFeedback({
      lock: async () => { events.push("lock"); },
      count: async since => {
        events.push("count");
        assert.ok(since.getTime() >= before - 86400000 && since.getTime() <= Date.now() - 86400000);
        return count;
      },
      create: async () => { events.push("create"); return { id: "saved" }; },
    });
    assert.deepEqual(result, count < 200 ? { id: "saved" } : null);
    assert.deepEqual(events, count < 200 ? ["lock", "count", "create"] : ["lock", "count"]);
  }
  const f = fake(); f.deps.save = async () => null;
  assert.equal((await submitFeedback(request({ ...valid, contactEmail: "human@example.test" }), "web", f.deps)).status, 429);
  assert.equal(f.notifications(), 0);
});
