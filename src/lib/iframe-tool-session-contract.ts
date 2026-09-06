/**
 * Iframe-tool sessions: the identity contract for the `iframe-tool` rung.
 *
 * A tool embedded from `*.vercel.app` and friends runs on someone else's
 * origin. It cannot read AppAI's cookies and AppAI cannot read its state, so
 * without help the only way it can tell who is using it is to invent its own
 * credential and ask the visitor to paste it — which is exactly the thing this
 * platform exists to remove.
 *
 * So AppAI mints a short-lived, opaque token per render and puts it on the
 * iframe URL as `appai_session`. The tool's *backend* hands it back to
 * `POST /api/v1/tools/sessions/introspect` and is told who is watching. Same
 * shape as the Universal App runtime session (RFC 7662 introspection), one rung
 * down.
 *
 * The token is signed rather than stored. A hosted page is public and gets
 * crawled, so minting is on the render path: a database row per page view would
 * be write amplification on an anonymous request. Signing costs nothing, needs
 * no table and no reaper. What it gives up is revocation — hence the short TTL,
 * and hence introspection re-reading the user (and their role) from the
 * database on every call rather than trusting anything inside the token beyond
 * "which user, and for whom was this minted".
 *
 * Everything here is pure so it can be tested without a database. The key
 * derivation and the database read live in `iframe-tool-session.ts`.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Ten minutes. The token travels on a URL, which means it can end up in the
 * tool's own access logs, so the window in which a leaked one is worth anything
 * is kept small. Long-lived tools are not expected to live with that: the
 * embedding page reissues and posts a fresh token in before this runs out
 * (see `IframeToolSection`).
 */
export const IFRAME_TOOL_SESSION_TTL_MS = 10 * 60 * 1000;

/** Clocks between the minting and introspecting hosts are not synchronised. */
const CLOCK_SKEW_SEC = 60;

/** Version prefix, so a format change is a rejection rather than a mystery. */
const TOKEN_PREFIX = "appai1";

/**
 * Iframe tools hold no capability grants — there is no per-tool consent screen
 * at this rung, so there is nothing that could have granted `identity`. Passing
 * this through the Universal App sanitiser keeps one rule for "may this caller
 * see a name and an email" instead of two that drift apart.
 */
export const IFRAME_TOOL_CAPABILITIES: readonly string[] = [];

export interface IframeToolSessionClaims {
  /** Origin this token is bound to, e.g. `https://acme-tools.vercel.app`. */
  aud: string;
  /** Page slug the section sits on. Context for the tool, not a gate. */
  slug: string;
  /** `order` of the section within that page. Context, not a gate. */
  section: number;
  /** Viewer's user id, or `null` for an anonymous visitor. */
  sub: string | null;
  /** Issued at / expires at, seconds since the epoch. */
  iat: number;
  exp: number;
}

function b64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

/**
 * Domain-separated from every other use of the platform secret: a signature
 * made here must not be verifiable anywhere else, and vice versa.
 */
export function deriveIframeToolSessionKey(secret: string): Buffer {
  return createHmac("sha256", secret).update("appai:iframe-tool-session:v1").digest();
}

/**
 * The comparable form of an origin. Returns `null` for anything that is not an
 * https origin, which is also everything the iframe-tool allowlist rejects.
 */
export function normalizeToolOrigin(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  return url.origin.toLowerCase();
}

function sign(body: string, key: Buffer): string {
  return b64url(createHmac("sha256", key).update(body).digest());
}

export function signIframeToolSession(claims: IframeToolSessionClaims, key: Buffer): string {
  const payload = b64url(JSON.stringify(claims));
  const body = `${TOKEN_PREFIX}.${payload}`;
  return `${body}.${sign(body, key)}`;
}

function signaturesMatch(expected: string, supplied: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  // timingSafeEqual throws on a length mismatch, which would itself leak.
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseClaims(payload: string): IframeToolSessionClaims | null {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const claims = value as Record<string, unknown>;
  if (typeof claims.aud !== "string" || typeof claims.slug !== "string") return null;
  if (typeof claims.section !== "number" || !Number.isFinite(claims.section)) return null;
  if (claims.sub !== null && typeof claims.sub !== "string") return null;
  if (typeof claims.iat !== "number" || typeof claims.exp !== "number") return null;
  return {
    aud: claims.aud,
    slug: claims.slug,
    section: claims.section,
    sub: claims.sub as string | null,
    iat: claims.iat,
    exp: claims.exp,
  };
}

/**
 * Verify a token against the origin of the caller asking about it.
 *
 * `origin` is the introspecting backend describing *itself*, not the token
 * describing where it came from. That is the whole point of the binding: a
 * hostile tool on the same page can read the visitor's token for its own
 * origin, but replaying it against a second tool's backend fails, because that
 * backend names its own origin and the audiences do not match.
 */
export function verifyIframeToolSession(
  token: string,
  key: Buffer,
  opts: { origin: string; now?: Date },
): IframeToolSessionClaims | null {
  const audience = normalizeToolOrigin(opts.origin);
  if (!audience) return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  const body = `${parts[0]}.${parts[1]}`;
  if (!signaturesMatch(sign(body, key), parts[2])) return null;

  const claims = parseClaims(parts[1]);
  if (!claims) return null;
  if (normalizeToolOrigin(claims.aud) !== audience) return null;

  const nowSec = Math.floor((opts.now?.getTime() ?? Date.now()) / 1000);
  if (claims.exp <= nowSec) return null;
  if (claims.iat > nowSec + CLOCK_SKEW_SEC) return null;
  return claims;
}

/** What a section's `data.access` asks the platform to do about this viewer. */
export type SectionAccessDecision = "render" | "sign-in" | "hidden";

/**
 * The gate every section shares. `login` was the only rung that existed;
 * `admin` is the same gate one step further, so a tool can be published — and
 * indexed, and linked — while remaining usable only by the owner.
 *
 * A logged-in non-admin gets `hidden` rather than a second prompt: they are
 * already signed in, so there is nothing for them to do about it.
 */
export function decideSectionAccess(
  access: unknown,
  viewer: { isLoggedIn: boolean; isAdmin: boolean },
): SectionAccessDecision {
  if (access !== "login" && access !== "admin") return "render";
  if (!viewer.isLoggedIn) return "sign-in";
  if (access === "admin" && !viewer.isAdmin) return "hidden";
  return "render";
}

/** Does this section want AppAI to hand the embedded tool an identity? */
export function sectionWantsIdentity(data: unknown): boolean {
  return Boolean((data as { identity?: unknown } | null | undefined)?.identity === true);
}
