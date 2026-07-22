import { validateApiKey } from "@/lib/api-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireSameOrigin } from "@/lib/request-security";

export type PublisherAuthentication = { organizationId: string; via: "api-key" | "session" };
export type PublisherAuthResult = PublisherAuthentication | { error: "INVALID_ORIGIN" } | null;

/** Publisher endpoints accept either an agent API key or the signed-in AppAI
 * browser session. Session mutations are same-origin to keep CSRF protection
 * equivalent to the rest of the platform. */
export async function requirePublisherOrganization(request: Request, mutation = false): Promise<PublisherAuthResult> {
  const key = await validateApiKey(request.headers.get("authorization"));
  if (key) return { organizationId: key.organizationId, via: "api-key" as const };

  const session = await auth();
  if (!session?.user?.id) return null;
  if (mutation) {
    try {
      requireSameOrigin(request);
    } catch {
      return { error: "INVALID_ORIGIN" as const };
    }
  }
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { organizationId: true } });
  return user?.organizationId ? { organizationId: user.organizationId, via: "session" as const } : null;
}
