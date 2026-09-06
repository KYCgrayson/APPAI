import assert from "node:assert/strict";
import test from "node:test";

import {
  decideSectionAccess,
  deriveIframeToolSessionKey,
  IFRAME_TOOL_SESSION_TTL_MS,
  normalizeToolOrigin,
  sectionWantsIdentity,
  signIframeToolSession,
  verifyIframeToolSession,
  type IframeToolSessionClaims,
} from "../src/lib/iframe-tool-session-contract.ts";

const key = deriveIframeToolSessionKey("test-platform-secret");
const otherKey = deriveIframeToolSessionKey("a different platform secret");
const origin = "https://acme-tools.vercel.app";

function claims(overrides: Partial<IframeToolSessionClaims> = {}): IframeToolSessionClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    aud: origin,
    slug: "batch-console",
    section: 2,
    sub: "usr_1",
    iat: now,
    exp: now + IFRAME_TOOL_SESSION_TTL_MS / 1000,
    ...overrides,
  };
}

test("a tool backend naming its own origin gets the claims back", () => {
  const token = signIframeToolSession(claims(), key);
  const verified = verifyIframeToolSession(token, key, { origin });
  assert.ok(verified);
  assert.equal(verified.sub, "usr_1");
  assert.equal(verified.slug, "batch-console");
  assert.equal(verified.section, 2);
});

test("an anonymous visitor still gets a real token, carrying no user", () => {
  const token = signIframeToolSession(claims({ sub: null }), key);
  const verified = verifyIframeToolSession(token, key, { origin });
  assert.ok(verified);
  assert.equal(verified.sub, null);
});

test("a token replayed against a second tool's backend does not verify", () => {
  // The whole reason the token is bound to an origin: a hostile tool embedded
  // on the same page can read it, but cannot spend it somewhere else.
  const token = signIframeToolSession(claims(), key);
  assert.equal(verifyIframeToolSession(token, key, { origin: "https://evil.pages.dev" }), null);
});

test("origin comparison ignores case and trailing path", () => {
  const token = signIframeToolSession(claims(), key);
  assert.ok(verifyIframeToolSession(token, key, { origin: "https://Acme-Tools.Vercel.App/thing" }));
});

test("editing the payload in the URL invalidates the token", () => {
  const token = signIframeToolSession(claims({ sub: "usr_1" }), key);
  const [prefix, payload, signature] = token.split(".");
  const forged = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  forged.sub = "usr_someone_else";
  const tampered = [prefix, Buffer.from(JSON.stringify(forged)).toString("base64url"), signature].join(".");
  assert.equal(verifyIframeToolSession(tampered, key, { origin }), null);
});

test("a token signed with another secret does not verify", () => {
  const token = signIframeToolSession(claims(), otherKey);
  assert.equal(verifyIframeToolSession(token, key, { origin }), null);
});

test("an expired token is simply inactive", () => {
  const past = Math.floor(Date.now() / 1000) - 3600;
  const token = signIframeToolSession(claims({ iat: past, exp: past + 600 }), key);
  assert.equal(verifyIframeToolSession(token, key, { origin }), null);
});

test("garbage, wrong shape and wrong version are rejected without throwing", () => {
  for (const token of ["", "nonsense", "a.b.c", "appai1.zzz.zzz", "appai2.x.y"]) {
    assert.equal(verifyIframeToolSession(token, key, { origin }), null);
  }
});

test("http origins are never a valid audience", () => {
  assert.equal(normalizeToolOrigin("http://my-tools.vercel.app"), null);
  assert.equal(normalizeToolOrigin("not a url"), null);
  assert.equal(normalizeToolOrigin("https://Example.com/a/b"), "https://example.com");
});

test("access gate: login and admin, for each kind of visitor", () => {
  const anon = { isLoggedIn: false, isAdmin: false };
  const user = { isLoggedIn: true, isAdmin: false };
  const admin = { isLoggedIn: true, isAdmin: true };

  assert.equal(decideSectionAccess(undefined, anon), "render");
  assert.equal(decideSectionAccess("login", anon), "sign-in");
  assert.equal(decideSectionAccess("login", user), "render");
  assert.equal(decideSectionAccess("admin", anon), "sign-in");
  // Signed in but not an admin: hidden, not prompted — signing in again is not
  // going to help.
  assert.equal(decideSectionAccess("admin", user), "hidden");
  assert.equal(decideSectionAccess("admin", admin), "render");
  // An unknown value must not be read as a gate that happens to be open.
  assert.equal(decideSectionAccess("owner", user), "render");
});

test("identity is opt-in and strictly boolean true", () => {
  assert.equal(sectionWantsIdentity({ identity: true }), true);
  assert.equal(sectionWantsIdentity({ identity: "true" }), false);
  assert.equal(sectionWantsIdentity({ identity: false }), false);
  assert.equal(sectionWantsIdentity({}), false);
  assert.equal(sectionWantsIdentity(undefined), false);
});
