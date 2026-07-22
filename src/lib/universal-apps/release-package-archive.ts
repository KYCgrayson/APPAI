import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

export const MAX_RELEASE_PACKAGE_BYTES = 20 * 1024 * 1024;
export const MAX_RELEASE_PACKAGE_FILES = 10_000;
export const MAX_RELEASE_PACKAGE_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const MAX_RELEASE_PACKAGE_PATH_LENGTH = 240;

const TAR_BLOCK_SIZE = 512;
const SUPPORTED_LOCKFILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
const PRIVATE_FILENAME = /^(?:\.env(?:\.(?!example$).*)?|id_(?:rsa|dsa|ecdsa|ed25519)|.*\.(?:pem|key|p12|pfx)|(?:credentials|secrets?)\.json|service-account.*\.json)$/i;

export type ReleasePackageArchive = {
  files: string[];
  totalUncompressedBytes: number;
};

function archiveError(code: string): never {
  throw new Error(code);
}

function text(bytes: Buffer, start: number, length: number) {
  const field = bytes.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? field.length : end).toString("utf8");
}

function octal(bytes: Buffer, start: number, length: number) {
  const field = bytes.subarray(start, start + length);
  if (field[0] !== undefined && (field[0] & 0x80) !== 0) archiveError("PACKAGE_ARCHIVE_INVALID_SIZE");
  const value = text(bytes, start, length).trim();
  if (!value) return 0;
  if (!/^[0-7]+$/.test(value)) archiveError("PACKAGE_ARCHIVE_INVALID_SIZE");
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) archiveError("PACKAGE_ARCHIVE_INVALID_SIZE");
  return parsed;
}

function isZeroBlock(bytes: Buffer, offset: number) {
  for (let index = offset; index < offset + TAR_BLOCK_SIZE; index += 1) {
    if (bytes[index] !== 0) return false;
  }
  return true;
}

function validChecksum(bytes: Buffer, offset: number) {
  const stored = octal(bytes, offset + 148, 8);
  let actual = 0;
  for (let index = 0; index < TAR_BLOCK_SIZE; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : bytes[offset + index]!;
  }
  return stored === actual;
}

function normalizedPath(name: string, prefix: string, type: string) {
  const raw = `${prefix ? `${prefix}/` : ""}${name}`;
  const path = type === "5" ? raw.replace(/\/+$/, "") : raw;
  if (!path || path.length > MAX_RELEASE_PACKAGE_PATH_LENGTH || path.includes("\\") || /[\u0000-\u001f]/.test(path)) {
    archiveError("PACKAGE_ARCHIVE_INVALID_PATH");
  }
  if (path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === "..")) {
    archiveError("PACKAGE_ARCHIVE_INVALID_PATH");
  }
  const parts = path.split("/");
  // Registry and Yarn configuration can contain credentials, custom registry
  // routing, or executable plugin settings. Package uploads use only the
  // platform's locked dependency install, so these files are prohibited at
  // every depth. Standard npm, pnpm, and Yarn lockfile-based projects remain
  // supported without them.
  if (parts.includes(".git") || parts.includes(".vercel") || parts.includes("node_modules") || PRIVATE_FILENAME.test(parts.at(-1)!) || parts.some((part) => [".npmrc", ".yarnrc", ".yarnrc.yml"].includes(part))) {
    archiveError("PACKAGE_ARCHIVE_FORBIDDEN_FILE");
  }
  return path;
}

// Git's `git archive --format=tar.gz` emits a PAX global `comment=<commit>`
// record. Allow that one inert metadata form, but reject every PAX key which
// could rewrite paths, ownership, timestamps, or extraction behavior.
function assertGitPaxComment(bytes: Buffer) {
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(0x20, offset);
    if (space === -1) archiveError("PACKAGE_ARCHIVE_UNSAFE_ENTRY");
    const recordLength = Number.parseInt(bytes.subarray(offset, space).toString("ascii"), 10);
    if (!Number.isSafeInteger(recordLength) || recordLength <= (space - offset) + 2 || offset + recordLength > bytes.length) archiveError("PACKAGE_ARCHIVE_UNSAFE_ENTRY");
    const record = bytes.subarray(space + 1, offset + recordLength);
    if (record.at(-1) !== 0x0a) archiveError("PACKAGE_ARCHIVE_UNSAFE_ENTRY");
    const equal = record.indexOf(0x3d);
    if (equal === -1 || record.subarray(0, equal).toString("ascii") !== "comment") archiveError("PACKAGE_ARCHIVE_UNSAFE_ENTRY");
    offset += recordLength;
  }
}

/**
 * Inspects a gzip tarball before it is ever written into a build sandbox.
 * The parser intentionally accepts only ordinary USTAR regular files and
 * directories; PAX/GNU extension records and all link/device entry types are
 * rejected rather than relying on a platform tar implementation to interpret
 * them safely.
 */
export function inspectReleasePackageArchive(bytes: Uint8Array): ReleasePackageArchive {
  if (!bytes.byteLength || bytes.byteLength > MAX_RELEASE_PACKAGE_BYTES) archiveError("PACKAGE_ARCHIVE_TOO_LARGE");
  let tar: Buffer;
  try {
    tar = gunzipSync(Buffer.from(bytes), {
      // Include room for the tar header/padding associated with the maximum
      // entry count, while capping decompression before it can become a zip bomb.
      maxOutputLength: MAX_RELEASE_PACKAGE_UNCOMPRESSED_BYTES + (MAX_RELEASE_PACKAGE_FILES * TAR_BLOCK_SIZE) + (2 * TAR_BLOCK_SIZE),
    });
  } catch {
    archiveError("PACKAGE_ARCHIVE_INVALID_GZIP");
  }

  const files: string[] = [];
  const seen = new Set<string>();
  let totalUncompressedBytes = 0;
  let entries = 0;
  let offset = 0;
  let terminated = false;
  while (offset + TAR_BLOCK_SIZE <= tar.length) {
    if (isZeroBlock(tar, offset)) {
      if (offset + (2 * TAR_BLOCK_SIZE) > tar.length || !isZeroBlock(tar, offset + TAR_BLOCK_SIZE)) archiveError("PACKAGE_ARCHIVE_INVALID_TAR");
      for (let index = offset + (2 * TAR_BLOCK_SIZE); index < tar.length; index += 1) {
        if (tar[index] !== 0) archiveError("PACKAGE_ARCHIVE_TRAILING_DATA");
      }
      terminated = true;
      break;
    }
    if (!validChecksum(tar, offset)) archiveError("PACKAGE_ARCHIVE_INVALID_TAR");
    const size = octal(tar, offset + 124, 12);
    const type = String.fromCharCode(tar[offset + 156] || 0);
    if (type !== "5" && type !== "g") {
      totalUncompressedBytes += size;
      if (totalUncompressedBytes > MAX_RELEASE_PACKAGE_UNCOMPRESSED_BYTES) archiveError("PACKAGE_ARCHIVE_UNCOMPRESSED_TOO_LARGE");
    }
    const paddedSize = Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
    if (!Number.isSafeInteger(paddedSize) || offset + TAR_BLOCK_SIZE + paddedSize > tar.length) archiveError("PACKAGE_ARCHIVE_TRUNCATED");
    entries += 1;
    if (entries > MAX_RELEASE_PACKAGE_FILES) archiveError("PACKAGE_ARCHIVE_TOO_MANY_FILES");
    if (type === "g") {
      if (text(tar, offset, 100) !== "pax_global_header" || size > 64 * 1024) archiveError("PACKAGE_ARCHIVE_UNSAFE_ENTRY");
      assertGitPaxComment(tar.subarray(offset + TAR_BLOCK_SIZE, offset + TAR_BLOCK_SIZE + size));
      offset += TAR_BLOCK_SIZE + paddedSize;
      continue;
    }
    if (type !== "\0" && type !== "0" && type !== "5") archiveError("PACKAGE_ARCHIVE_UNSAFE_ENTRY");
    const path = normalizedPath(text(tar, offset, 100), text(tar, offset + 345, 155), type);
    if (seen.has(path)) archiveError("PACKAGE_ARCHIVE_DUPLICATE_PATH");
    seen.add(path);
    files.push(path);
    if (type === "5" && size !== 0) archiveError("PACKAGE_ARCHIVE_INVALID_TAR");
    offset += TAR_BLOCK_SIZE + paddedSize;
  }
  if (!terminated) archiveError("PACKAGE_ARCHIVE_INVALID_TAR");

  const fileSet = new Set(files);
  if (!fileSet.has("appai.app.json") || !fileSet.has("package.json")) archiveError("PACKAGE_ARCHIVE_REQUIRED_FILE_MISSING");
  const lockfiles = [...SUPPORTED_LOCKFILES].filter((name) => fileSet.has(name));
  if (lockfiles.length !== 1) archiveError("PACKAGE_ARCHIVE_LOCKFILE_REQUIRED");
  return { files, totalUncompressedBytes };
}

export function assertReleasePackageDigest(bytes: Uint8Array, expectedDigest: string) {
  if (!/^sha256:[0-9a-f]{64}$/i.test(expectedDigest)) archiveError("PACKAGE_DIGEST_INVALID");
  if (!bytes.byteLength || bytes.byteLength > MAX_RELEASE_PACKAGE_BYTES) archiveError("PACKAGE_ARCHIVE_TOO_LARGE");
  const actual = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (actual !== expectedDigest.toLowerCase()) archiveError("PACKAGE_DIGEST_MISMATCH");
  return actual;
}
