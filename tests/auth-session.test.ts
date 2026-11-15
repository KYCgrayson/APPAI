import assert from "node:assert/strict";
import test from "node:test";
import { publicSession } from "../src/lib/auth-session.ts";

function adapterSession() {
  return {
    id: "session-row-id",
    sessionToken: "synthetic-cookie-secret",
    userId: "user-1",
    expires: new Date("2026-12-01T00:00:00.000Z"),
    user: {
      id: "user-1",
      name: "Example User",
      email: "user@example.test",
      image: "https://example.test/avatar.png",
      emailVerified: new Date("2026-01-01T00:00:00.000Z"),
      role: "USER",
      organizationId: "stale-org",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-11-01T00:00:00.000Z"),
    },
  };
}

test("public session allowlists adapter data without leaking or mutating it", () => {
  const session = adapterSession();
  const before = structuredClone(session);
  const dbUser = Object.freeze({ organizationId: "org-1", role: "ADMIN" });
  Object.freeze(session.user);
  Object.freeze(session);

  const result = publicSession(session, session.user, dbUser);
  assert.deepEqual(Object.keys(result).sort(), ["expires", "organizationId", "role", "user"]);
  assert.deepEqual(Object.keys(result.user).sort(), ["email", "id", "image", "name"]);
  assert.deepEqual(result, {
    user: {
      id: "user-1",
      name: "Example User",
      email: "user@example.test",
      image: "https://example.test/avatar.png",
    },
    expires: "2026-12-01T00:00:00.000Z",
    organizationId: "org-1",
    role: "ADMIN",
  });
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /sessionToken/);
  assert.ok(!json.includes(session.sessionToken));
  assert.deepEqual(session, before);
  assert.notStrictEqual(result.user, session.user);
});

test("missing database user falls back to USER and no organization", () => {
  const session = adapterSession();
  session.user.role = "ADMIN";
  const result = publicSession(session, session.user, null);
  assert.equal(result.user.id, "user-1");
  assert.equal(result.role, "USER");
  assert.equal(result.organizationId, null);
  assert.doesNotMatch(JSON.stringify(result), /sessionToken|synthetic-cookie-secret/);
});

test("public session preserves string expiry and nullable profile and organization fields", () => {
  const expires = "2026-12-01T00:00:00.000Z";
  const result = publicSession(
    { expires },
    { id: "user-2", name: null, email: null },
    { organizationId: null, role: "USER" },
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    user: { id: "user-2", name: null, email: null, image: null },
    expires,
    organizationId: null,
    role: "USER",
  });
});
