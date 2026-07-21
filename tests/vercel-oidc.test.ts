import assert from "node:assert/strict";
import test from "node:test";

import { getVercelOidcToken } from "../src/lib/universal-apps/vercel-oidc.ts";

test("incoming Vercel OIDC header is used ahead of the local fallback", () => {
  const token = getVercelOidcToken(new Headers({ "x-vercel-oidc-token": "request-token" }), "local-token");

  assert.equal(token, "request-token");
});

test("missing Vercel OIDC header and fallback leaves provider credentials unavailable", () => {
  const token = getVercelOidcToken(new Headers(), undefined);

  assert.equal(token, undefined);
});
