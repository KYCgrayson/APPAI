/**
 * The API-key release status contract intentionally has a smaller shape than
 * the persistence models. In particular, manifests and operational runtime
 * URLs are not an owner-facing API surface.
 */
export type ReleaseStatusDeploymentRecord = {
  environment: string;
  status: string;
  healthCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  managedRuntime: {
    failureCode: string | null;
    failureMessage: string | null;
  } | null;
};

export type ReleaseStatusRecord = {
  id: string;
  version: string;
  status: string;
  sourceType?: string;
  sourceRevision: string | null;
  artifactDigest: string | null;
  createdAt: Date;
  updatedAt: Date;
  deployments: ReleaseStatusDeploymentRecord[];
};

export function canReadUniversalApp(ownerOrganizationId: string, appOrganizationId: string): boolean {
  return ownerOrganizationId === appOrganizationId;
}

export function mapUniversalAppDeploymentStatus(deployment: ReleaseStatusDeploymentRecord) {
  return {
    environment: deployment.environment,
    status: deployment.status,
    healthCheckedAt: deployment.healthCheckedAt,
    createdAt: deployment.createdAt,
    updatedAt: deployment.updatedAt,
    ...(deployment.status === "FAILED"
      ? {
          failure: {
            code: deployment.managedRuntime?.failureCode ?? null,
            message: deployment.managedRuntime?.failureMessage ?? null,
          },
        }
      : {}),
  };
}

export function mapUniversalAppReleaseStatus(release: ReleaseStatusRecord) {
  return {
    releaseId: release.id,
    version: release.version,
    status: release.status,
    sourceType: release.sourceType ?? "REPOSITORY",
    sourceRevision: release.sourceRevision,
    ...(release.status === "APPROVED" && release.artifactDigest
      ? { artifactDigest: release.artifactDigest }
      : {}),
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
    deployments: release.deployments.map(mapUniversalAppDeploymentStatus),
  };
}
