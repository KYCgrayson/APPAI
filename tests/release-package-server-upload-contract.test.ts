import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  canUploadReleasePackageOnServer,
  isWithinReleasePackageServerRequestLimit,
  RELEASE_PACKAGE_SERVER_UPLOAD_MAX_BYTES,
  RELEASE_PACKAGE_SERVER_UPLOAD_REQUEST_MAX_BYTES,
} from "../src/lib/universal-apps/release-package-server-upload.ts";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const now = new Date("2026-07-23T00:00:00.000Z");
const upload = {
  organizationId: "org-owner",
  appType: "inventory-db",
  status: "UPLOADING",
  expiresAt: new Date("2026-07-23T00:15:00.000Z"),
  expectedSizeBytes: 1024,
  contentType: "application/gzip",
};
const expected = { organizationId: "org-owner", appType: "inventory-db", now, sizeBytes: 1024, contentType: "application/gzip" };

test("server package upload accepts only the owning, unexpired small upload with exact bytes and content type", () => {
  assert.equal(RELEASE_PACKAGE_SERVER_UPLOAD_MAX_BYTES, 4 * 1024 * 1024);
  assert.equal(RELEASE_PACKAGE_SERVER_UPLOAD_REQUEST_MAX_BYTES < 4.5 * 1024 * 1024, true);
  const allowedContentTypes = ["application/gzip", "application/x-gzip", "application/octet-stream"];
  assert.equal(canUploadReleasePackageOnServer(upload, expected, allowedContentTypes), true);
  assert.equal(canUploadReleasePackageOnServer({ ...upload, organizationId: "org-other" }, expected, allowedContentTypes), false);
  assert.equal(canUploadReleasePackageOnServer({ ...upload, appType: "other-app" }, expected, allowedContentTypes), false);
  assert.equal(canUploadReleasePackageOnServer({ ...upload, status: "CONSUMED" }, expected, allowedContentTypes), false);
  assert.equal(canUploadReleasePackageOnServer({ ...upload, expiresAt: now }, expected, allowedContentTypes), false);
  assert.equal(canUploadReleasePackageOnServer({ ...upload, expectedSizeBytes: RELEASE_PACKAGE_SERVER_UPLOAD_MAX_BYTES + 1 }, { ...expected, sizeBytes: RELEASE_PACKAGE_SERVER_UPLOAD_MAX_BYTES + 1 }, allowedContentTypes), false);
  assert.equal(canUploadReleasePackageOnServer(upload, { ...expected, sizeBytes: 1025 }, allowedContentTypes), false);
  assert.equal(canUploadReleasePackageOnServer(upload, { ...expected, contentType: "application/octet-stream" }, allowedContentTypes), false);
});

test("server package upload rejects excessive or malformed Content-Length before multipart parsing", () => {
  assert.equal(isWithinReleasePackageServerRequestLimit(null), true);
  assert.equal(isWithinReleasePackageServerRequestLimit(String(RELEASE_PACKAGE_SERVER_UPLOAD_REQUEST_MAX_BYTES)), true);
  assert.equal(isWithinReleasePackageServerRequestLimit(String(RELEASE_PACKAGE_SERVER_UPLOAD_REQUEST_MAX_BYTES + 1)), false);
  assert.equal(isWithinReleasePackageServerRequestLimit("4.2"), false);
  assert.equal(isWithinReleasePackageServerRequestLimit("-1"), false);
});

test("small server route is publisher-authenticated, scoped, and keeps Blob transport secrets out of its response", () => {
  const route = read("src/app/api/v1/apps/[id]/release-packages/[uploadId]/upload/route.ts");
  const intentRoute = read("src/app/api/v1/apps/[id]/release-packages/route.ts");
  const beforeFormData = route.indexOf("isWithinReleasePackageServerRequestLimit");
  const formData = route.indexOf("request.formData()");

  assert.match(route, /requirePublisherOrganization\(request, true\)/);
  assert.match(route, /organizationId: authResult\.organizationId, appType: appId\.data/);
  assert.equal(beforeFormData >= 0 && beforeFormData < formData, true);
  assert.match(route, /canUploadReleasePackageOnServer\(upload/);
  assert.match(route, /access: "private"/);
  assert.match(route, /allowOverwrite: false/);
  assert.match(route, /NextResponse\.json\(\{ uploadId: upload\.id, status: "UPLOADING" \}/);
  assert.doesNotMatch(route, /NextResponse\.json\([^\n]*(?:pathname|clientToken|downloadUrl|blob\.url)/);
  const serverIntentBranch = intentRoute.slice(intentRoute.lastIndexOf('input.data.uploadMethod === "server"'), intentRoute.indexOf("const clientToken"));
  assert.match(serverIntentBranch, /uploadId: upload\.id/);
  assert.doesNotMatch(serverIntentBranch, /pathname|clientToken/);
});

test("Publisher uses same-origin server upload for small packages and bounds direct uploads with an abort timeout", () => {
  const form = read("src/components/publisher/PublisherReleaseForm.tsx");

  assert.match(form, /const SERVER_UPLOAD_MAX_BYTES = 4 \* 1024 \* 1024/);
  assert.match(form, /uploadMethod: useServerUpload \? "server" : "client"/);
  assert.match(form, /release-packages\/\$\{encodeURIComponent\(uploadId\)\}\/upload/);
  assert.match(form, /credentials: "same-origin"/);
  assert.match(form, /new AbortController\(\)/);
  assert.match(form, /abortSignal: controller\.signal/);
  assert.match(form, /Private package upload timed out/);
});

test("Publisher captures its form before asynchronous publishing and never dereferences the deferred event target", () => {
  const form = read("src/components/publisher/PublisherReleaseForm.tsx");

  assert.match(form, /event\.preventDefault\(\);\s*\n\s*const form = event\.currentTarget;/);
  assert.match(form, /form\.elements\.namedItem\("package"\)/);
  assert.doesNotMatch(form, /await[\s\S]*event\.currentTarget\.elements/);
});
