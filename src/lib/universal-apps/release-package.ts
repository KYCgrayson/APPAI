import { createHash, randomUUID } from "node:crypto";

import { get } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

import { getPrivateBlobAuth } from "@/lib/private-assets/auth";
export {
  canUploadReleasePackageOnServer,
  isWithinReleasePackageServerRequestLimit,
  RELEASE_PACKAGE_SERVER_UPLOAD_MAX_BYTES,
  RELEASE_PACKAGE_SERVER_UPLOAD_REQUEST_MAX_BYTES,
} from "./release-package-server-upload";

export const RELEASE_PACKAGE_MAX_BYTES = 20 * 1024 * 1024;
export const RELEASE_PACKAGE_TTL_MS = 15 * 60 * 1000;
export const RELEASE_PACKAGE_CONTENT_TYPES = ["application/gzip", "application/x-gzip", "application/octet-stream"] as const;

/** A deliberately narrow error that HTTP routes may expose as a configuration outage. */
export class ReleasePackagePrivateStorageNotConfiguredError extends Error {
  constructor() {
    super("PRIVATE_STORAGE_NOT_CONFIGURED");
    this.name = "ReleasePackagePrivateStorageNotConfiguredError";
  }
}

export function isReleasePackagePrivateStorageNotConfiguredError(error: unknown) {
  return error instanceof ReleasePackagePrivateStorageNotConfiguredError;
}

export function releasePackagePath(_organizationId: string, _appType: string, filename: string) {
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "_");
  return `universal-release-packages/${randomUUID()}-${safeName}`;
}

export async function createReleasePackageUploadToken(input: {
  pathname: string;
  sizeBytes: number;
  expiresAt: Date;
}) {
  const blobAuth = getPrivateBlobAuth();
  if (!blobAuth.configured) throw new ReleasePackagePrivateStorageNotConfiguredError();
  return generateClientTokenFromReadWriteToken({
    pathname: input.pathname,
    maximumSizeInBytes: input.sizeBytes,
    allowedContentTypes: [...RELEASE_PACKAGE_CONTENT_TYPES],
    validUntil: input.expiresAt.getTime(),
    addRandomSuffix: false,
    allowOverwrite: false,
    ...blobAuth.options,
  });
}

export async function readAndVerifyReleasePackage(input: {
  pathname: string;
  expectedDigest: string;
  expectedSizeBytes: number;
  expectedContentType: string;
}) {
  const blobAuth = getPrivateBlobAuth();
  if (!blobAuth.configured) throw new ReleasePackagePrivateStorageNotConfiguredError();
  const result = await get(input.pathname, { access: "private", useCache: false, ...blobAuth.options });
  if (!result || result.statusCode !== 200) return null;
  if (result.blob.contentType !== input.expectedContentType || !RELEASE_PACKAGE_CONTENT_TYPES.includes(result.blob.contentType as typeof RELEASE_PACKAGE_CONTENT_TYPES[number])) return { valid: false as const };

  const hash = createHash("sha256");
  let sizeBytes = 0;
  const reader = result.stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sizeBytes += value.byteLength;
      if (sizeBytes > RELEASE_PACKAGE_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { valid: false as const };
      }
      hash.update(value);
    }
  } finally {
    reader.releaseLock();
  }
  const digest = `sha256:${hash.digest("hex")}`;
  return {
    valid: sizeBytes === input.expectedSizeBytes && digest.toLowerCase() === input.expectedDigest.toLowerCase(),
    sizeBytes,
    digest,
    contentType: result.blob.contentType,
  };
}
