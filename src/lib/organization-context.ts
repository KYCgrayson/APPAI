import "server-only";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NativeAppError } from "@/lib/native-apps/errors";

export interface OrganizationContext {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  organizationId: string;
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

export async function requireOrganizationContext(): Promise<OrganizationContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new NativeAppError("UNAUTHENTICATED", 401, "Authentication required.");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      organization: { select: { id: true, name: true, slug: true, plan: true } },
    },
  });

  if (!user?.organizationId || !user.organization) {
    throw new NativeAppError(
      "ORGANIZATION_REQUIRED",
      403,
      "A valid Organization is required for native apps.",
    );
  }

  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    organizationId: user.organizationId,
    role: user.role,
    organization: user.organization,
  };
}
