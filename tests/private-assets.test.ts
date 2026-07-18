import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePrivateAssetQuota,
  getPrivateAssetLimits,
} from "../src/lib/private-assets/limits.ts";
import {
  safePrivateAssetFilename,
  validatePrivateAssetFile,
} from "../src/lib/private-assets/file-validation.ts";

const limits = getPrivateAssetLimits({
  SIMPLESHOP_PRIVATE_ASSET_MAX_FILE_BYTES: "1000",
  SIMPLESHOP_PRIVATE_ASSET_ORG_LIMIT_BYTES: "10000",
  SIMPLESHOP_PRIVATE_ASSET_LARGE_FILE_BYTES: "500",
});

test("private asset quota applies file, organization and 95% large-file limits", () => {
  assert.equal(evaluatePrivateAssetQuota(0, 1001, limits).reason, "FILE_TOO_LARGE");
  assert.equal(evaluatePrivateAssetQuota(9501, 500, limits).reason, "ORGANIZATION_QUOTA_EXCEEDED");
  assert.equal(evaluatePrivateAssetQuota(9500, 500, limits).reason, "LARGE_FILES_PAUSED");
  assert.equal(evaluatePrivateAssetQuota(7900, 100, limits).allowed, true);
  assert.equal(evaluatePrivateAssetQuota(7900, 200, limits).level, "review");
});

test("private file validation checks MIME and magic bytes", async () => {
  const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], "invoice.pdf", {
    type: "application/pdf",
  });
  const fakePdf = new File(["not a pdf"], "invoice.pdf", { type: "application/pdf" });
  const svg = new File(["<svg></svg>"], "x.svg", { type: "image/svg+xml" });
  assert.equal((await validatePrivateAssetFile(pdf)).valid, true);
  assert.equal((await validatePrivateAssetFile(fakePdf)).valid, false);
  assert.equal((await validatePrivateAssetFile(svg)).valid, false);
});

test("private filenames cannot escape their organization prefix", () => {
  const filename = safePrivateAssetFilename("../../ 客戶/帳單 7月.pdf");
  assert.equal(filename.includes("/"), false);
  assert.equal(filename.includes(".."), false);
  assert.match(filename, /pdf$/);
});
