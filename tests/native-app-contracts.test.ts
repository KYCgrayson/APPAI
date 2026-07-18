import test from "node:test";
import assert from "node:assert/strict";
import {
  getNativeAppDefinition,
  isNativeAppType,
  listNativeAppDefinitions,
} from "../src/lib/native-apps/registry.ts";
import { safeInternalPath } from "../src/lib/redirects.ts";
import {
  mergeSimpleshopSettings,
  parseSimpleshopSettings,
  simpleshopSettingsPatchSchema,
} from "../src/lib/simpleshop/settings-schema.ts";
import { createAppInstanceSchema } from "../src/lib/validations/app-instance.ts";
import { isLookupKind } from "../src/lib/simpleshop/lookups.ts";
import { simpleOrderSubmissionSchema } from "../src/lib/validations/simple-order-section.ts";
import { hasSameOrigin } from "../src/lib/request-security.ts";

test("native app registry exposes only the approved Simpleshop definition", () => {
  assert.equal(isNativeAppType("simpleshop"), true);
  assert.equal(isNativeAppType("../../server"), false);
  assert.equal(getNativeAppDefinition("unknown"), null);
  assert.deepEqual(listNativeAppDefinitions().map((app) => app.type), ["simpleshop"]);
  assert.equal(getNativeAppDefinition("simpleshop")?.runtimePath, "/app/simpleshop");
});

test("app instance input rejects organization and executable platform fields", () => {
  assert.equal(createAppInstanceSchema.safeParse({ appType: "simpleshop" }).success, true);
  for (const key of ["organizationId", "runtimePath", "component", "sql", "secret"]) {
    assert.equal(
      createAppInstanceSchema.safeParse({ appType: "simpleshop", [key]: "forged" }).success,
      false,
      key,
    );
  }
});

test("safe callback paths reject open redirects and control characters", () => {
  assert.equal(safeInternalPath("/app/simpleshop?tab=settings"), "/app/simpleshop?tab=settings");
  assert.equal(safeInternalPath("https://evil.example/steal"), "/dashboard");
  assert.equal(safeInternalPath("//evil.example/steal"), "/dashboard");
  assert.equal(safeInternalPath("/app\\evil"), "/dashboard");
  assert.equal(safeInternalPath("/%2F%2Fevil.example/steal"), "/dashboard");
});

test("Simpleshop settings use defaults, strict validation and non-destructive merges", () => {
  const defaults = parseSimpleshopSettings(null);
  assert.equal(defaults.timezone, "Asia/Taipei");
  assert.equal(defaults.currency, "TWD");

  assert.equal(simpleshopSettingsPatchSchema.safeParse({ organizationId: "org-b" }).success, false);
  assert.equal(simpleshopSettingsPatchSchema.safeParse({ timezone: "Not/A-Timezone" }).success, false);
  assert.equal(simpleshopSettingsPatchSchema.safeParse({ currency: "NT" }).success, false);

  const merged = mergeSimpleshopSettings(
    { schemaVersion: 1, futureFlag: true, settings: defaults },
    { shopName: "灰熊建材", print: { phone: "02-1234-5678" } },
  );
  assert.equal(merged.futureFlag, true);
  assert.equal(parseSimpleshopSettings(merged).shopName, "灰熊建材");
  assert.equal(parseSimpleshopSettings(merged).print.phone, "02-1234-5678");
});

test("lookup contract recognizes only the three approved boundaries", () => {
  assert.equal(isLookupKind("customer"), true);
  assert.equal(isLookupKind("job-site"), true);
  assert.equal(isLookupKind("item"), true);
  assert.equal(isLookupKind("organization"), false);
});

test("simple-order accepts real ISO dates and rejects impossible dates", () => {
  const submission = {
    pageSlug: "shop",
    locale: "zh-TW",
    customer: { name: "Test", email: "test@example.com" },
    preferredDate: "2026-07-31",
    items: [{ name: "Item", quantity: 1, unitPrice: 10 }],
  };
  assert.equal(simpleOrderSubmissionSchema.safeParse(submission).success, true);
  assert.equal(simpleOrderSubmissionSchema.safeParse({
    ...submission,
    preferredDate: "2026-02-31",
  }).success, false);
});

test("native app mutations accept only an explicit matching Origin", () => {
  assert.equal(hasSameOrigin(new Request("https://appai.info/api/apps/simpleshop/settings", {
    headers: { Origin: "https://appai.info" },
  })), true);
  assert.equal(hasSameOrigin(new Request("https://appai.info/api/apps/simpleshop/settings", {
    headers: { Origin: "https://evil.example" },
  })), false);
  assert.equal(hasSameOrigin(new Request("https://appai.info/api/apps/simpleshop/settings")), false);
});
