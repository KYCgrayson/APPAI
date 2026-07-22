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

  assert.match(instructions, /PENDING.*managed release receipt/);
  assert.match(instructions, /immutable (?:source )?package/i);
  assert.match(instructions, /repository URL is optional/i);
  assert.match(instructions, /release-packages/);
  assert.match(instructions, /PENDING[\s\S]{0,120}awaiting AppAI platform review/i);
  assert.match(instructions, /AppAI administrator[\s\S]{0,120}starts the managed/i);
  assert.match(instructions, /GET \/api\/v1\/apps\/\{appId\}\/releases\/\{releaseId\}/);
  assert.match(instructions, /isolated sandbox/);
  assert.match(instructions, /health check/);
  assert.match(instructions, /\/app\/\{appId\}/);
  assert.doesNotMatch(instructions, /agents cannot upload executable code/i);
});

test("public publishing contract makes the package upload, finalize, and status flow explicit", () => {
  const materials = [
    read("AGENT_INSTRUCTIONS.md"),
    read("skills/appai-publish/SKILL.md"),
    read("src/app/llms.txt/route.ts"),
  ];

  for (const content of materials) {
    assert.match(content, /repository(?:\s+URL)?(?:\s+is)?\s+optional|Git\s+repository\s+is\s+optional/i);
    assert.match(content, /(?:primary publishing input|package source is primary|publish an immutable source package)/i);
    assert.match(content, /POST (?:\$\{baseUrl\})?\/api\/v1\/apps\/\{appId\}\/release-packages/);
    assert.match(content, /uploadId/);
    assert.match(content, /POST (?:\$\{baseUrl\})?\/api\/v1\/apps\/\{appId\}\/releases/);
    assert.match(content, /source[\s\S]{0,180}(?:"type"|type)\s*:\s*["']package["'][\s\S]{0,120}uploadId[\s\S]{0,120}digest[\s\S]{0,120}sizeBytes/i);
    assert.match(content, /GET (?:\$\{baseUrl\})?\/api\/v1\/apps\/\{appId\}\/releases\/\{releaseId\}/);
    assert.match(content, /(?:never|do not)\s+(?:submit|send|provide)[\s\S]{0,220}organizationId/i);
    assert.match(content, /(?:never|do not)\s+(?:submit|send|provide)[\s\S]{0,140}(?:secrets?|credentials)/i);
  }
});

test("public publishing materials distinguish PENDING review from administrator-started delivery", () => {
  const materials = [
    read("AGENT_INSTRUCTIONS.md"),
    read("skills/appai-publish/SKILL.md"),
  ];

  for (const content of materials) {
    assert.match(content, /PENDING[\s\S]{0,160}(?:awaits|awaiting)[\s\S]{0,80}(?:platform )?review/i);
    assert.match(content, /AppAI\s+administrator[\s\S]{0,140}(?:starts|start)[\s\S]{0,80}(?:managed )?(?:pipeline|validation)/i);
    assert.match(content, /immutable[\s\S]{0,80}(?:package|archive)|package[\s\S]{0,80}primary/i);
    assert.match(content, /release-packages/);
    assert.match(content, /package\.json[\s\S]{0,100}test[\s\S]{0,80}typecheck/i);
    assert.match(content, /test[\s\S]{0,80}typecheck[\s\S]{0,100}(?:declared )?build command[\s\S]{0,60}(?:pass|exit 0)/i);
    assert.doesNotMatch(content, /PENDING\s+(?:receipt\s+)?(?:starts|begins)\s+(?:the\s+)?(?:managed\s+)?(?:pipeline|validation|deploy)/i);
  }
});

test("public contract makes the AppAI subdomain runtime platform-managed and isolated", () => {
  const materials = [
    read("AGENT_INSTRUCTIONS.md"),
    read("skills/appai-publish/SKILL.md"),
  ];

  for (const content of materials) {
    assert.match(content, /https:\/\/\{appId\}\.appai\.info/);
    assert.match(content, /one-time (?:identity )?(?:handoff|launch code)/i);
    assert.match(content, /isolated runtime|isolated deployment/i);
    assert.match(content, /(?:cannot|never|must not)[\s\S]{0,160}(?:supply|choose|select)[\s\S]{0,80}runtime domain/i);
  }
});

test("public contract includes a package-first generic database application release example", () => {
  const instructions = read("AGENT_INSTRUCTIONS.md");
  const quickstart = read("src/app/llms.txt/route.ts");

  assert.match(instructions, /"id":\s*"inventory"/i);
  assert.match(instructions, /"schemaVersion":\s*1/);
  assert.match(instructions, /"type":\s*"node"/);
  assert.match(instructions, /"installCommand":\s*"npm ci"/);
  assert.match(instructions, /"buildCommand":\s*"npm run build"/);
  assert.match(instructions, /"startCommand":\s*"npm run start"/);
  assert.match(instructions, /"healthPath":\s*"\/api\/health"/);
  assert.match(instructions, /"migrationCommand":\s*"npm run migrate"/);
  assert.match(instructions, /"entryPath":\s*"\/app\/inventory"/);
  assert.match(instructions, /"callbackPath":\s*"\/api\/appai\/callback"/);
  assert.match(instructions, /"capabilities":\s*\["identity",\s*"database"\]/);

  for (const content of [instructions, quickstart]) {
    assert.match(content, /appai\.app\.json/);
    assert.match(content, /git archive --format=tar\.gz/);
    assert.match(content, /"type": ?"package"/);
    assert.match(content, /uploadId/);
    assert.match(content, /sha256:/i);
    assert.match(content, /isolated (?:sandbox|runtime)|in isolation/i);
    assert.match(content, /health(?:-| )check/i);
    assert.match(content, /APPROVED.*ACTIVE|ACTIVE.*APPROVED/i);
    assert.match(content, /app-scoped\s+PostgreSQL/i);
    assert.match(content, /DATABASE_URL/);
    assert.match(content, /separate\s+migration role/i);
    assert.match(content, /APPAI_PLATFORM_URL/);
    assert.match(content, /APPAI_APP_ID/);
    assert.match(content, /OIDC\/CLI|provider credentials/i);
    assert.match(content, /launch-code\s+exchange\/introspection|runtime\s+session introspection/i);
    assert.match(content, /Never accept[\s\S]{0,40}userId[\s\S]{0,40}organizationId/i);
  }
});

test("public contract requires generic Universal App auth chrome and safe logout", () => {
  const instructions = read("AGENT_INSTRUCTIONS.md");
  const quickstart = read("src/app/llms.txt/route.ts");

  for (const content of [instructions, quickstart]) {
    assert.match(content, /\/app\/\{appId\}.*(?:SSO|login gate)/i);
    assert.match(content, /POST \/api\/runtime\/sessions\/exchange/);
    assert.match(content, /POST \/api\/runtime\/sessions\/introspect/);
    assert.match(content, /top-right(?:\s+app)? header/i);
    assert.match(content, /Return to AppAI/);
    assert.match(content, /app logout\s+action/i);
    assert.match(content, /POST \/api\/runtime\/sessions\/revoke/);
    assert.match(content, /strict matching.{0,5}appId/i);
    assert.match(content, /HttpOnly runtime-session cookie/i);
    assert.match(content, /\/logout\?callbackUrl=\//);
    assert.match(content, /runtime token/i);
    assert.match(content, /userId/i);
    assert.match(content, /organizationId/i);
  }
});

test("operator release queue redacts package transport details while identifying package releases", () => {
  const queue = read("src/app/admin/universal-apps/page.tsx");

  assert.match(queue, /releasePackage:\s*\{\s*select:\s*\{\s*sourceDigest:\s*true,\s*actualSizeBytes:\s*true/);
  assert.match(queue, /release\.sourceType === "PACKAGE"/);
  assert.match(queue, /Source type/);
  assert.match(queue, /Verified package/);
  assert.match(queue, /Not required/);
  assert.doesNotMatch(queue, /releasePackage\?\.pathname|releasePackage\.pathname/);
});
