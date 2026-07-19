export interface PrivateAssetLimits {
  maxFileBytes: number;
  organizationLimitBytes: number;
  largeFileBytes: number;
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getPrivateAssetLimits(
  env: Record<string, string | undefined> = process.env,
): PrivateAssetLimits {
  return {
    maxFileBytes: positiveInt(env.SIMPLESHOP_PRIVATE_ASSET_MAX_FILE_BYTES, 2 * 1024 * 1024),
    organizationLimitBytes: positiveInt(env.SIMPLESHOP_PRIVATE_ASSET_ORG_LIMIT_BYTES, 100 * 1024 * 1024),
    largeFileBytes: positiveInt(env.SIMPLESHOP_PRIVATE_ASSET_LARGE_FILE_BYTES, 512 * 1024),
  };
}

export function evaluatePrivateAssetQuota(
  currentBytes: number,
  incomingBytes: number,
  limits: PrivateAssetLimits,
) {
  const currentPercent = (currentBytes / limits.organizationLimitBytes) * 100;
  const projectedBytes = currentBytes + incomingBytes;
  const projectedPercent = (projectedBytes / limits.organizationLimitBytes) * 100;

  if (incomingBytes > limits.maxFileBytes) {
    return { allowed: false as const, reason: "FILE_TOO_LARGE", currentPercent, projectedPercent };
  }
  if (projectedBytes > limits.organizationLimitBytes) {
    return { allowed: false as const, reason: "ORGANIZATION_QUOTA_EXCEEDED", currentPercent, projectedPercent };
  }
  if (currentPercent >= 95 && incomingBytes >= limits.largeFileBytes) {
    return { allowed: false as const, reason: "LARGE_FILES_PAUSED", currentPercent, projectedPercent };
  }

  const level = projectedPercent >= 95
    ? "critical"
    : projectedPercent >= 80
      ? "review"
      : projectedPercent >= 60
        ? "warning"
        : "normal";
  return { allowed: true as const, level, currentPercent, projectedPercent };
}
