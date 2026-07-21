import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPinnedSnapshot,
  assertProviderUrl,
  assertManagedRuntimeUrl,
  deployValidatedRelease,
  parseValidatedManifest,
  redactProviderLog,
  validateRelease,
  type SandboxCommand,
  type SandboxFactory,
} from "../src/lib/universal-apps/vercel-sandbox-provider.ts";

const manifestObject = {
  schemaVersion: 1,
  id: "inventory-db",
  name: "Inventory",
  version: "1.0.0",
  runtime: {
    type: "node",
    installCommand: "pnpm install --frozen-lockfile",
    buildCommand: "pnpm run build",
    startCommand: "pnpm run start",
    healthPath: "/health",
  },
  entryPath: "/",
  callbackPath: "/callback",
  capabilities: ["database", "identity"],
} as const;
const snapshot = {
  appId: "inventory-db",
  version: "1.0.0",
  repoUrl: "https://github.com/acme/inventory",
  sourceRevision: "a".repeat(40),
  manifest: manifestObject,
};
const manifest = JSON.stringify(manifestObject);
const success = { exitCode: 0, stdout: "", stderr: "" };

function recordingFactory(respond: (command: SandboxCommand) => { exitCode: number; stdout: string; stderr: string }) {
  const created: Parameters<SandboxFactory["create"]>[0][] = [];
  const commands: SandboxCommand[] = [];
  const factory: SandboxFactory = {
    async create(input) {
      created.push(input);
      return { async run(command) { commands.push(command); return respond(command); } };
    },
  };
  return { factory, created, commands };
}

test("provider requires exact SHA and credential-free source", () => {
  assert.doesNotThrow(() => assertPinnedSnapshot(snapshot));
  assert.throws(() => assertPinnedSnapshot({ ...snapshot, sourceRevision: "main" }));
  assert.throws(() => assertPinnedSnapshot({ ...snapshot, repoUrl: "https://token@github.com/acme/inventory" }));
  assert.throws(() => assertPinnedSnapshot({ ...snapshot, repoUrl: "https://127.0.0.1/internal/repo" }));
  assert.throws(() => assertPinnedSnapshot({ ...snapshot, repoUrl: "https://example.com/acme/inventory" }));
});

test("full canonical manifest validation rejects nested and capability mismatches", () => {
  const reordered = JSON.stringify({ ...manifestObject, capabilities: ["database", "identity"], runtime: { healthPath: "/health", startCommand: "pnpm run start", buildCommand: "pnpm run build", installCommand: "pnpm install --frozen-lockfile", type: "node" } });
  const digest = parseValidatedManifest(reordered, snapshot);
  assert.match(digest, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(digest, parseValidatedManifest(reordered, { ...snapshot, sourceRevision: "b".repeat(40) }));
  assert.throws(() => parseValidatedManifest(JSON.stringify({ ...manifestObject, runtime: { ...manifestObject.runtime, healthPath: "/other" } }), snapshot), /MANIFEST_MISMATCH/);
  assert.throws(() => parseValidatedManifest(JSON.stringify({ ...manifestObject, capabilities: ["database"] }), snapshot), /MANIFEST_MISMATCH/);
  assert.throws(() => parseValidatedManifest(JSON.stringify({ ...manifestObject, runtime: { ...manifestObject.runtime, installCommand: "npm install --ignore-scripts" } }), snapshot), /MANIFEST_MISMATCH/);
  assert.equal(assertProviderUrl("https://appai-app-inventory-db.vercel.app", "inventory-db"), "https://appai-app-inventory-db.vercel.app");
  assert.equal(assertManagedRuntimeUrl("https://inventory-db.appai.info", "inventory-db"), "https://inventory-db.appai.info");
  assert.throws(() => assertProviderUrl("https://appai-app-inventory-db-other.vercel.app", "inventory-db"));
  assert.throws(() => assertManagedRuntimeUrl("https://api.appai.info", "inventory-db"));
});

test("validation uses the pinned source and only schema-approved package commands", async () => {
  const record = recordingFactory((command) => command.cmd === "cat" ? { ...success, stdout: manifest } : success);
  await validateRelease(record.factory, snapshot);
  assert.deepEqual(record.created, [{ phase: "validation", source: { repoUrl: snapshot.repoUrl, revision: snapshot.sourceRevision }, persistent: false, timeoutMs: 600_000, tags: { appId: snapshot.appId, phase: "validation" } }]);
  assert.deepEqual(record.commands.map(({ cmd, args }) => [cmd, ...args]), [
    ["cat", "appai.app.json"],
    ["pnpm", "install", "--frozen-lockfile"],
    ["pnpm", "test"],
    ["pnpm", "run", "typecheck"],
    ["pnpm", "run", "build"],
  ]);
  assert.equal(record.commands.every((command) => command.env === undefined), true);
});

test("provider creates and verifies its project before adding secrets with a pinned CLI", async () => {
  const record = recordingFactory((command) => {
    const line = [command.cmd, ...command.args].join(" ");
    if (line.includes("project ls")) return { ...success, stdout: JSON.stringify({ projects: [{ name: "appai-app-inventory-db", id: "prj_1" }] }) };
    if (line.includes("inspect")) return { ...success, stdout: JSON.stringify({ id: "dpl_1", readyState: "READY", alias: ["https://appai-app-inventory-db.vercel.app", "https://inventory-db.appai.info"] }) };
    if (line.includes("deploy")) return { ...success, stdout: "https://appai-app-inventory-db.vercel.app\n" };
    return success;
  });
  const result = await deployValidatedRelease(record.factory, { appId: "inventory-db", repoUrl: snapshot.repoUrl, revision: snapshot.sourceRevision, oidcToken: "oidc-secret", platformUrl: "https://appai.info", databaseUrl: "postgresql://user:pass@db.example/app" });
  assert.deepEqual(result, { providerProjectId: "prj_1", providerDeploymentId: "dpl_1", publicRuntimeUrl: "https://inventory-db.appai.info" });
  assert.deepEqual(record.created[0]?.source, { repoUrl: snapshot.repoUrl, revision: snapshot.sourceRevision });
  const projectAdd = record.commands.findIndex((command) => command.args.join(" ").includes("project add"));
  const projectList = record.commands.find((command) => command.args.join(" ").includes("project ls"));
  const deploy = record.commands.findIndex((command) => command.args.join(" ").includes(" deploy "));
  assert.ok(deploy >= 0 && projectAdd < deploy);
  assert.ok(projectList?.args.join(" ").includes('--filter "$APPAI_PROJECT" --limit 100'));
  const tools = record.commands[0];
  assert.deepEqual(tools, { cmd: "npm", args: ["install", "--prefix", "/tmp/appai-provider", "--ignore-scripts", "vercel@56.4.1"], cwd: "/tmp" });
  assert.equal(record.commands.some((command) => command.args.join(" ").includes(" env add ")), false);
  const secretCommand = record.commands.find((command) => command.args.join(" ").includes(" deploy "));
  assert.ok(secretCommand);
  assert.equal(secretCommand.args.join(" ").includes("postgresql://user:pass@db.example/app"), false);
  assert.equal(secretCommand.args.join(" ").includes("$DATABASE_URL"), true);
  assert.equal(secretCommand.env?.DATABASE_URL, "postgresql://user:pass@db.example/app");
});

test("provider rejects ambiguous or non-Vercel deploy output before aliasing", async () => {
  const record = recordingFactory((command) => {
    const line = [command.cmd, ...command.args].join(" ");
    if (line.includes("project ls")) return { ...success, stdout: JSON.stringify([{ name: "appai-app-inventory-db", id: "prj_1" }]) };
    if (line.includes("deploy")) return { ...success, stdout: "https://one.vercel.app\nhttps://two.vercel.app" };
    return success;
  });
  await assert.rejects(() => deployValidatedRelease(record.factory, { appId: "inventory-db", repoUrl: snapshot.repoUrl, revision: snapshot.sourceRevision, oidcToken: "oidc", platformUrl: "https://appai.info" }), /INVALID_PROVIDER_RESPONSE/);
  assert.equal(record.commands.some((command) => command.args.join(" ").includes("alias set")), false);
});

test("provider retries inspect until the custom alias is reflected", async () => {
  let inspections = 0;
  const record = recordingFactory((command) => {
    const line = [command.cmd, ...command.args].join(" ");
    if (line.includes("project ls")) return { ...success, stdout: JSON.stringify([{ name: "appai-app-inventory-db", id: "prj_1" }]) };
    if (line.includes("deploy")) return { ...success, stdout: "https://appai-app-inventory-db.vercel.app" };
    if (line.includes("inspect")) {
      inspections += 1;
      return { ...success, stdout: JSON.stringify({ id: "dpl_1", readyState: inspections === 1 ? "BUILDING" : "READY", aliases: inspections === 1 ? ["appai-app-inventory-db.vercel.app"] : ["appai-app-inventory-db.vercel.app", "inventory-db.appai.info"] }) };
    }
    return success;
  });
  await deployValidatedRelease(record.factory, { appId: "inventory-db", repoUrl: snapshot.repoUrl, revision: snapshot.sourceRevision, oidcToken: "oidc", platformUrl: "https://appai.info", inspectWait: async () => {} });
  assert.equal(inspections, 2);
});

test("a failed project add is tolerated only for a verified existing project", async () => {
  const existing = recordingFactory((command) => {
    const line = [command.cmd, ...command.args].join(" ");
    if (line.includes("project add")) return { exitCode: 1, stdout: "Project already exists", stderr: "" };
    if (line.includes("project ls")) return { ...success, stdout: JSON.stringify([{ name: "appai-app-inventory-db", id: "prj_1" }]) };
    if (line.includes("inspect")) return { ...success, stdout: JSON.stringify({ id: "dpl_1", readyState: "READY", aliases: ["appai-app-inventory-db.vercel.app", "inventory-db.appai.info"] }) };
    if (line.includes("deploy")) return { ...success, stdout: "https://appai-app-inventory-db.vercel.app" };
    return success;
  });
  await assert.doesNotReject(() => deployValidatedRelease(existing.factory, { appId: "inventory-db", repoUrl: snapshot.repoUrl, revision: snapshot.sourceRevision, oidcToken: "oidc", platformUrl: "https://appai.info", databaseUrl: "postgresql://db" }));

  const failed = recordingFactory((command) => {
    const line = [command.cmd, ...command.args].join(" ");
    if (line.includes("project add")) return { exitCode: 1, stdout: "network unavailable", stderr: "" };
    if (line.includes("project ls")) return { ...success, stdout: JSON.stringify([{ name: "appai-app-inventory-db", id: "prj_1" }]) };
    return success;
  });
  await assert.rejects(() => deployValidatedRelease(failed.factory, { appId: "inventory-db", repoUrl: snapshot.repoUrl, revision: snapshot.sourceRevision, oidcToken: "oidc", platformUrl: "https://appai.info", databaseUrl: "postgresql://db" }), /network unavailable/);
});

test("provider logs redact database and OIDC credentials", () => {
  const value = redactProviderLog("DATABASE_URL=postgresql://u:p@host/db VERCEL_OIDC_TOKEN=abc");
  assert.equal(value.includes("postgresql://"), false);
  assert.equal(value.includes("abc"), false);
});
