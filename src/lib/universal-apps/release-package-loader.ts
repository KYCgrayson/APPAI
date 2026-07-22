import { get } from "@vercel/blob";

import { getPrivateBlobAuth } from "@/lib/private-assets/auth";

import { assertReleasePackageDigest, MAX_RELEASE_PACKAGE_BYTES } from "./release-package-archive.ts";

const RELEASE_PACKAGE_CONTENT_TYPES = new Set(["application/gzip", "application/x-gzip", "application/octet-stream"]);

/**
 * Reads an immutable release blob only inside the trusted AppAI process. The
 * resulting bytes are handed directly to a sandbox write operation; callers
 * must never turn this into a URL or pass storage credentials to app code.
 */
export async function loadPrivateReleasePackage(input: { pathname: string; digest: string; sizeBytes: number }) {
  if (!input.pathname.startsWith("universal-release-packages/") || input.pathname.length > 1024 || !Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_RELEASE_PACKAGE_BYTES) {
    throw new Error("RELEASE_PACKAGE_INVALID");
  }
  const blobAuth = getPrivateBlobAuth();
  if (!blobAuth.configured) throw new Error("PRIVATE_STORAGE_NOT_CONFIGURED");
  const result = await get(input.pathname, { access: "private", useCache: false, ...blobAuth.options });
  if (!result || result.statusCode !== 200) throw new Error("RELEASE_PACKAGE_NOT_FOUND");
  if (!RELEASE_PACKAGE_CONTENT_TYPES.has(result.blob.contentType)) throw new Error("RELEASE_PACKAGE_INVALID_CONTENT_TYPE");

  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_RELEASE_PACKAGE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("PACKAGE_ARCHIVE_TOO_LARGE");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (length !== input.sizeBytes) throw new Error("RELEASE_PACKAGE_SIZE_MISMATCH");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  assertReleasePackageDigest(bytes, input.digest);
  return bytes;
}
