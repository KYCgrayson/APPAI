import "server-only";

import { db } from "@/lib/db";
import { checkIframeToolUrl } from "@/lib/iframe-tool-allowlist";
import { sanitizeUniversalRuntimeIdentity } from "@/lib/universal-apps/runtime-session-contract";
import {
  deriveIframeToolSessionKey,
  IFRAME_TOOL_CAPABILITIES,
  IFRAME_TOOL_SESSION_TTL_MS,
  normalizeToolOrigin,
  signIframeToolSession,
  verifyIframeToolSession,
} from "@/lib/iframe-tool-session-contract";

/**
 * Server half of the iframe-tool identity contract: the signing key, and the
 * database read that turns a verified token into "who is watching".
 * The format itself lives in `iframe-tool-session-contract.ts`.
 */

let cachedKey: Buffer | null = null;

function sessionKey(): Buffer | null {
  if (cachedKey) return cachedKey;
  const secret = process.env.NEXTAUTH_SECRET;
  // No secret means no signing key, which means no identity — never an
  // unsigned or predictable token.
  if (!secret) return null;
  cachedKey = deriveIframeToolSessionKey(secret);
  return cachedKey;
}

export interface IframeToolSessionGrant {
  token: string;
  expiresAt: Date;
}

/**
 * Mint the token that goes on the iframe URL. Called on the render path, so it
 * does no I/O.
 *
 * `userId` is `null` for an anonymous visitor, and that is still worth a token:
 * it lets the tool tell "nobody is signed in" apart from "this page never
 * offered me an identity", which are very different things to build on.
 */
export function issueIframeToolSession(input: {
  src: string;
  slug: string;
  section: number;
  userId: string | null;
  now?: Date;
}): IframeToolSessionGrant | null {
  const key = sessionKey();
  if (!key) return null;

  // Bind to the origin the iframe will actually be served from, and only if it
  // passes the same allowlist that decides whether the iframe renders at all.
  const check = checkIframeToolUrl(input.src);
  if (!check.ok || !check.url) return null;
  const audience = normalizeToolOrigin(check.url.origin);
  if (!audience) return null;

  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + IFRAME_TOOL_SESSION_TTL_MS);
  return {
    token: signIframeToolSession(
      {
        aud: audience,
        slug: input.slug,
        section: input.section,
        sub: input.userId,
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000),
      },
      key,
    ),
    expiresAt,
  };
}

export type IframeToolIntrospection =
  | { active: false }
  | {
      active: true;
      user: { id: string; name: string | null; email: string | null } | null;
      organization: { id: string; name: string } | null;
      isAdmin: boolean;
      page: { slug: string; section: number };
      expiresAt: string;
    };

/**
 * Answer "who is this?" for a tool backend holding an `appai_session`.
 *
 * Nothing about the viewer is trusted from the token beyond the user id it was
 * minted for: the name, the organization and above all `isAdmin` are read back
 * out of the database here, so a role that changed a minute ago is already
 * true for the tool.
 */
export async function introspectIframeToolSession(
  token: string,
  origin: string,
  now = new Date(),
): Promise<IframeToolIntrospection> {
  const key = sessionKey();
  if (!key) return { active: false };

  const claims = verifyIframeToolSession(token, key, { origin, now });
  if (!claims) return { active: false };

  const page = { slug: claims.slug, section: claims.section };
  const expiresAt = new Date(claims.exp * 1000).toISOString();

  // A valid token minted for nobody: the visitor was anonymous. Still active —
  // the tool decides whether anonymous is good enough for what it does.
  if (!claims.sub) {
    return { active: true, user: null, organization: null, isAdmin: false, page, expiresAt };
  }

  const user = await db.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organization: { select: { id: true, name: true } },
    },
  });
  // The account is gone; a token minted for it stops meaning anything.
  if (!user) return { active: false };

  // Only `user` is taken from the sanitiser: it owns the rule for whether a
  // caller may see a name and an email, and with no capability grants (there is
  // no consent screen at this rung) the answer here is always no.
  const { user: safeUser } = sanitizeUniversalRuntimeIdentity({
    user: { id: user.id, name: user.name, email: user.email },
    organization: user.organization ?? { id: "", name: "" },
    capabilities: [...IFRAME_TOOL_CAPABILITIES],
  });

  return {
    active: true,
    user: safeUser,
    organization: user.organization ?? null,
    isAdmin: user.role === "ADMIN",
    page,
    expiresAt,
  };
}
