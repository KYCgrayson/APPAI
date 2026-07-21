export type ReleaseReviewState = {
  label: string;
  tone: "neutral" | "warning" | "success" | "danger";
};

/**
 * Produces browser-safe review status from platform records only. This helper
 * intentionally never returns runtime commands, credentials, or manifest data
 * that could be treated as executable input.
 */
export function getReleaseReviewState(input: {
  releaseStatus: string;
  deploymentStatuses: string[];
}): ReleaseReviewState {
  if (input.deploymentStatuses.includes("ACTIVE")) {
    return { label: "Active deployment", tone: "success" };
  }
  if (input.deploymentStatuses.includes("FAILED")) {
    return { label: "Platform deployment failed", tone: "danger" };
  }
  if (input.deploymentStatuses.includes("PROVISIONING")) {
    return { label: "Platform build / provisioning in progress", tone: "warning" };
  }
  if (input.releaseStatus === "REJECTED") {
    return { label: "Release rejected", tone: "danger" };
  }
  if (input.releaseStatus === "RETIRED") {
    return { label: "Release retired", tone: "neutral" };
  }
  return { label: "Awaiting platform build / provisioning", tone: "warning" };
}

/** Accept only a credential-free HTTPS repository URL before rendering a link. */
export function getSafeRepositoryUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
