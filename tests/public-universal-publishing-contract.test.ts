import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("public agent instructions describe Hosted Pages and Universal Apps as first-class modes", () => {
  const instructions = read("AGENT_INSTRUCTIONS.md");
  const quickstart = read("src/app/llms.txt/route.ts");

  for (const content of [instructions, quickstart]) {
    assert.match(content, /Hosted Pages?/);
    assert.match(content, /Universal Apps?/);
    assert.match(content, /POST (?:\$\{baseUrl\})?\/api\/v1\/apps\/\{appId\}\/releases/);
    assert.match(content, /appai\.app\.json/);
    assert.match(content, /organizationId/);
    assert.match(content, /raw SQL|SQL/);
  }
});

test("public agent instructions make the Universal App flow platform-controlled", () => {
  const instructions = read("AGENT_INSTRUCTIONS.md");

  assert.match(instructions, /automatically reserves the AppAI slot/);
  assert.match(instructions, /GET \/api\/v1\/apps\/\{appId\}\/releases\/\{releaseId\}/);
  assert.match(instructions, /AppAI reviews, builds, and provisions/);
  assert.match(instructions, /\/app\/\{appId\}/);
  assert.doesNotMatch(instructions, /agents cannot upload executable code/i);
});

test("public contract includes a valid generic database application release example", () => {
  const instructions = read("AGENT_INSTRUCTIONS.md");
  const quickstart = read("src/app/llms.txt/route.ts");

  for (const content of [instructions, quickstart]) {
    assert.match(content, /"id": ?"inventory"/);
    assert.match(content, /"schemaVersion": ?1/);
    assert.match(content, /"type": ?"node"/);
    assert.match(content, /"buildCommand": ?"npm run build"/);
    assert.match(content, /"startCommand": ?"npm run start"/);
    assert.match(content, /"healthPath": ?"\/api\/health"/);
    assert.match(content, /"entryPath": ?"\/app\/inventory"/);
    assert.match(content, /"callbackPath": ?"\/api\/appai\/callback"/);
    assert.match(content, /"capabilities": ?\["identity", ?"database"\]/);
    assert.match(content, /"repoUrl": ?"https:\/\/github\.com\/example\/inventory-manager"/);
    assert.match(content, /"sourceRevision": ?"a1b2c3d"/);
    assert.match(content, /PENDING.? reserves (?:(?:a|the) )?slot/i);
    assert.match(content, /not deploy automatically|not automatic/i);
    assert.match(content, /app-scoped\s+PostgreSQL/i);
    assert.match(content, /DATABASE_URL/);
    assert.match(content, /separate\s+migration role/i);
    assert.match(content, /APPAI_PLATFORM_URL/);
    assert.match(content, /APPAI_APP_ID/);
    assert.match(content, /launch-code\s+exchange\/introspection|runtime\s+session introspection/i);
    assert.match(content, /Never accept[\s\S]{0,40}userId[\s\S]{0,40}organizationId/i);
  }
});
