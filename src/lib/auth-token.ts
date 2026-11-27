/**
 * How long a session cookie may serve its organization/role claims before the
 * next auth() re-reads them. Signed-in users cost at most one small query per
 * interval instead of a Session-table read (plus write) per request; a removed
 * user or a role change takes effect within this window.
 */
export const ACCESS_REFRESH_SECONDS = 5 * 60;

export type AccessClaims = {
  sub?: string;
  organizationId?: string | null;
  role?: string;
  accessCheckedAt?: number;
  [key: string]: unknown;
};

export type AccessStore = {
  user: {
    findUnique(args: { where: { id: string }; select: { organizationId: true; role: true } }):
      Promise<{ organizationId: string | null; role: string } | null>;
    updateMany(args: { where: { id: string; role: { not: string } }; data: { role: string } }): Promise<unknown>;
  };
};

type MemoEntry = { organizationId: string | null; role: string; checkedAt: number };
/**
 * Server Components can't rewrite the session cookie, so a stale cookie would
 * otherwise re-query on every server-side auth() until /api/auth/session
 * refreshes it. A warm instance shares the last read through this memo.
 */
export type AccessMemo = Map<string, MemoEntry>;
const MEMO_MAX_ENTRIES = 1000;

/** Session-facing view of the claims; missing claims fall back like a missing DB user did. */
export function tokenAccess(token: AccessClaims) {
  return typeof token.role === "string"
    ? { organizationId: typeof token.organizationId === "string" ? token.organizationId : null, role: token.role }
    : null;
}

/**
 * Auth.js `jwt` callback body. `user` is present only on sign-in/sign-up,
 * after the adapter (and the createUser event) has written the user row.
 * Returning null signs the visitor out.
 */
export async function refreshAccessToken<T extends AccessClaims>(
  token: T,
  user: { id?: string | null; email?: string | null } | null | undefined,
  deps: { store: AccessStore; isAdminEmail(email: string): boolean; memo?: AccessMemo },
  now = Math.floor(Date.now() / 1000),
): Promise<T | null> {
  const signingIn = !!user?.id;
  if (signingIn) token.sub = user!.id!;
  const userId = token.sub;
  if (!userId) return null;
  const fresh = typeof token.accessCheckedAt === "number"
    && now - token.accessCheckedAt >= 0 && now - token.accessCheckedAt < ACCESS_REFRESH_SECONDS;
  if (!signingIn && fresh) return token;
  const memo = deps.memo?.get(userId);
  if (!signingIn && memo && now - memo.checkedAt >= 0 && now - memo.checkedAt < ACCESS_REFRESH_SECONDS) {
    token.organizationId = memo.organizationId;
    token.role = memo.role;
    token.accessCheckedAt = memo.checkedAt;
    return token;
  }

  try {
    // Promotion has to run on every sign-in, not only at createUser. An
    // account that already existed when ADMIN_EMAILS was configured would
    // otherwise stay USER forever. It runs before the read so the new cookie
    // already carries ADMIN.
    if (signingIn && user?.email && deps.isAdminEmail(user.email)) {
      await deps.store.user.updateMany({ where: { id: userId, role: { not: "ADMIN" } }, data: { role: "ADMIN" } });
    }
    const row = await deps.store.user.findUnique({ where: { id: userId }, select: { organizationId: true, role: true } });
    if (!row) { deps.memo?.delete(userId); return null; } // deleted user: drop the cookie
    if (deps.memo) {
      if (deps.memo.size >= MEMO_MAX_ENTRIES) deps.memo.clear();
      deps.memo.set(userId, { organizationId: row.organizationId, role: row.role, checkedAt: now });
    }
    token.organizationId = row.organizationId;
    token.role = row.role;
    token.accessCheckedAt = now;
    return token;
  } catch (error) {
    // A database outage must not sign everyone out. Sign-in itself still
    // fails (it needs the database anyway); an existing session keeps its
    // last known claims and retries on the next request.
    if (signingIn) throw error;
    console.error("[auth] access refresh failed; keeping previous claims");
    return token;
  }
}
