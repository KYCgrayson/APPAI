import test from "node:test";
import assert from "node:assert/strict";
import { hostedPageApprovalUpdate } from "../src/lib/hosted-page-approval.ts";

test("new PERSON listings require review; GAME also requires review; other templates remain auto-approved", () => {
  assert.deepEqual(hostedPageApprovalUpdate("PERSON"), { isApproved: false });
  for (const template of ["APP_LANDING", "COMPANY_PROFILE", "PRODUCT_SHOWCASE", "PORTFOLIO", "LINK_IN_BIO"]) {
    assert.deepEqual(hostedPageApprovalUpdate(template), { isApproved: true });
  }
});

const root = { template: "PORTFOLIO", isDefault: true, parentSlug: null };
test("changing the default root to PERSON resets approval", () => {
  assert.deepEqual(hostedPageApprovalUpdate("PERSON", root), { isApproved: false });
});
test("ordinary edits and other template changes preserve approval", () => {
  assert.deepEqual(hostedPageApprovalUpdate("PERSON", { ...root, template: "PERSON" }), {});
  assert.deepEqual(hostedPageApprovalUpdate("APP_LANDING", root), {});
});
test("child pages cannot reset the root App approval", () => {
  assert.deepEqual(hostedPageApprovalUpdate("PERSON", { ...root, parentSlug: "other-site" }), {});

});

test("first PERSON root in a non-default locale resets approval", () => {
  const en = { template: "APP_LANDING", isDefault: true, parentSlug: null };
  const zhTW = { ...en, isDefault: false };
  assert.deepEqual(hostedPageApprovalUpdate("PERSON", zhTW, false), { isApproved: false });
  assert.deepEqual(hostedPageApprovalUpdate("PERSON", zhTW, true), {});
});
test("adding PERSON where another root is already PERSON preserves review approval", () => {
  assert.deepEqual(hostedPageApprovalUpdate("PERSON", root, true), {});
});


test("GAME listings require approval on creation and every root update", () => {
  assert.deepEqual(hostedPageApprovalUpdate("GAME"), { isApproved: false });
  for (const template of ["APP_LANDING", "PERSON", "GAME"]) for (const isDefault of [true, false]) {
    assert.deepEqual(hostedPageApprovalUpdate("GAME", { ...root, template, isDefault }), { isApproved: false });
  }
  assert.deepEqual(hostedPageApprovalUpdate("GAME", { ...root, parentSlug: "parent" }), {});
});
