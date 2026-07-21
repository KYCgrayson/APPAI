type ReleaseLike<TRelease, TDeployment> = TRelease & {
  status: string;
  deployments: Array<TDeployment & { environment: string; status: string }>;
};

export type UniversalRuntimeTarget<TRelease, TDeployment> =
  | { kind: "LAUNCH"; release: TRelease; deployment: TDeployment }
  | { kind: "APP_UNAVAILABLE" }
  | { kind: "INVALID_RELEASE" }
  | { kind: "INVALID_DEPLOYMENT" };

/**
 * Database results must be ordered newest-first. Choose any valid release
 * before reporting a bad record, so a rejected newer submission cannot take
 * down a still-active approved release. Without a valid target, an existing
 * rejected release or inactive production deployment fails closed instead of
 * being mistaken for an unprovisioned app.
 */
export function selectUniversalRuntimeTarget<TRelease, TDeployment>(
  releases: Array<ReleaseLike<TRelease, TDeployment>>,
  appIsApproved = true,
): UniversalRuntimeTarget<TRelease, TDeployment> {
  if (!appIsApproved) return { kind: "INVALID_RELEASE" };

  for (const release of releases) {
    for (const deployment of release.deployments) {
      if (release.status === "APPROVED" && deployment.environment === "PRODUCTION" && deployment.status === "ACTIVE") {
        return { kind: "LAUNCH", release, deployment };
      }
    }
  }

  if (releases.length === 0) return { kind: "APP_UNAVAILABLE" };
  if (releases.some((release) => release.status !== "APPROVED")) return { kind: "INVALID_RELEASE" };
  if (releases.some((release) => release.deployments.some(
    (deployment) => deployment.environment === "PRODUCTION" && deployment.status !== "ACTIVE",
  ))) {
    return { kind: "INVALID_DEPLOYMENT" };
  }
  return { kind: "APP_UNAVAILABLE" };
}
