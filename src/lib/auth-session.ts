type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type SessionAccess = {
  organizationId: string | null;
  role: string;
};

/** Allowlist browser-visible fields; never spread an adapter session or user row. */
export function publicSession(
  session: { expires: Date | string },
  user: SessionUser,
  dbUser: SessionAccess | null,
) {
  return {
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
    },
    expires: session.expires instanceof Date ? session.expires.toISOString() : session.expires,
    organizationId: dbUser?.organizationId ?? null,
    role: dbUser?.role ?? "USER",
  };
}
