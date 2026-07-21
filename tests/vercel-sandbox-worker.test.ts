import assert from "node:assert/strict";
import test from "node:test";

import { runIsolatedMigration } from "../src/lib/universal-apps/vercel-sandbox-worker.ts";

test("migration installs before receiving the scoped DB URL, restricts egress, and stops", async () => {
  const calls: Array<{ kind: string; value?: unknown }> = [];
  const factory = {
    async create() {
      return {
        async run(command: { cmd: string; args: string[]; env?: Record<string, string> }) {
          calls.push({ kind: "run", value: command });
          return { exitCode: 0, stdout: "", stderr: "" };
        },
        async restrictNetworkTo(hostname: string) { calls.push({ kind: "network", value: hostname }); },
        async stop() { calls.push({ kind: "stop" }); },
      };
    },
  };
  await runIsolatedMigration(factory, {
    appId: "inventory-db", repoUrl: "https://github.com/acme/inventory", sourceRevision: "a".repeat(40), migrationUrl: "postgresql://migration:secret@db.example/app",
    manifest: { schemaVersion: 1, id: "inventory-db", name: "Inventory", version: "1.0.0", runtime: { type: "node", installCommand: "npm ci", buildCommand: "npm run build", startCommand: "npm run start", healthPath: "/health", migrationCommand: "npm run migrate" }, entryPath: "/", callbackPath: "/callback", capabilities: ["database"] },
  });
  assert.deepEqual(calls.map((call) => call.kind), ["run", "network", "run", "stop"]);
  const install = calls[0]?.value as { env?: Record<string, string> };
  const migration = calls[2]?.value as { env?: Record<string, string> };
  assert.equal(install.env, undefined);
  assert.equal(migration.env?.DATABASE_URL?.includes("secret"), true);
  assert.equal(calls[1]?.value, "db.example");
});
