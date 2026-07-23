export const RELEASE_PACKAGE_SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
// Keep a comfortable margin below Vercel's 4.5 MiB server request-body limit.
export const RELEASE_PACKAGE_SERVER_UPLOAD_REQUEST_MAX_BYTES = RELEASE_PACKAGE_SERVER_UPLOAD_MAX_BYTES + (256 * 1024);

export function isWithinReleasePackageServerRequestLimit(contentLength: string | null) {
  if (contentLength === null) return true;
  if (!/^\d+$/.test(contentLength)) return false;
  const bytes = Number(contentLength);
  return Number.isSafeInteger(bytes) && bytes > 0 && bytes <= RELEASE_PACKAGE_SERVER_UPLOAD_REQUEST_MAX_BYTES;
}

export function canUploadReleasePackageOnServer(input: {
  organizationId: string;
  appType: string;
  status: string;
  expiresAt: Date;
  expectedSizeBytes: number;
  contentType: string;
}, expected: {
  organizationId: string;
  appType: string;
  now: Date;
  sizeBytes: number;
  contentType: string;
}, allowedContentTypes: readonly string[]) {
  return input.organizationId === expected.organizationId
    && input.appType === expected.appType
    && input.status === "UPLOADING"
    && input.expiresAt > expected.now
    && input.expectedSizeBytes === expected.sizeBytes
    && input.expectedSizeBytes <= RELEASE_PACKAGE_SERVER_UPLOAD_MAX_BYTES
    && input.contentType === expected.contentType
    && allowedContentTypes.includes(input.contentType);
}
