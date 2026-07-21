export type RuntimeDisplayUser = { id: string; name: string | null; email: string | null };

export function sanitizeUniversalRuntimeIdentity(input: {
  user: RuntimeDisplayUser;
  organization: { id: string; name: string };
  capabilities: string[];
}) {
  const hasIdentity = input.capabilities.includes("identity");
  return {
    user: {
      id: input.user.id,
      name: hasIdentity ? input.user.name : null,
      email: hasIdentity ? input.user.email : null,
    },
    organization: input.organization,
  };
}

export function runtimeSessionMatchesApp(input: {
  revokedAt: Date | null;
  expiresAt: Date;
  organizationAppStatus: string;
  deploymentStatus: string;
  releaseStatus: string;
  deployedAppId: string | null;
}, appId: string, now = new Date()): boolean {
  return !input.revokedAt && input.expiresAt > now &&
    input.organizationAppStatus === "ACTIVE" &&
    input.deploymentStatus === "ACTIVE" &&
    input.releaseStatus === "APPROVED" &&
    input.deployedAppId === appId;
}

/** Revocation is intentionally idempotent for a token that belongs to this app. */
export function canRevokeUniversalAppSession(deployedAppId: string | null, requestedAppId: string): boolean {
  return deployedAppId === requestedAppId;
}

export function universalAppUserRevocationScope(userId: string) {
  return { userId, revokedAt: null };
}

export function runtimeUserBelongsToOrganization(userOrganizationId: string | null, organizationId: string): boolean {
  return userOrganizationId === organizationId;
}
