import assert from "node:assert/strict";
import test from "node:test";

import {
  databaseNamesForDeployment,
  databaseMigrationExecutorRoleRevokeSql,
  databaseProvisionSql,
  retireManagedDatabaseAccess,
  databaseUrlForRole,
  provisionAppDatabase,
} from "../src/lib/universal-apps/database-provisioner.ts";

test("schema and migration owner are app-stable while runtime roles are deployment-distinct and safe", () => {
  const appA = databaseNamesForDeployment("inventory", "deployment_a");
  const appB = databaseNamesForDeployment("simpleshop", "deployment_b");
  const appANext = databaseNamesForDeployment("inventory", "deployment_b");
  assert.notDeepEqual(appA, appB);
  assert.equal(appA.schema, appANext.schema);
  assert.equal(appA.migrationRole, appANext.migrationRole);
  assert.notEqual(appA.runtimeRole, appANext.runtimeRole);
  for (const value of Object.values(appA)) assert.match(value, /^[a-z][a-z0-9_]{0,62}$/);
  const hyphenated = databaseNamesForDeployment("inventory-db", "deployment_a");
  for (const value of Object.values(hyphenated)) assert.match(value, /^[a-z][a-z0-9_]{0,62}$/);
});

test("runtime grants contain DML and sequences but no DDL or role authority", () => {
  const names = databaseNamesForDeployment("inventory", "deployment_a");
  const sql = databaseProvisionSql(names, { migration: "migration-secret", runtime: "runtime-secret" });
  const runtimeGrants = sql.filter((statement) => statement.startsWith("GRANT") || statement.startsWith("ALTER DEFAULT"));
  assert.match(runtimeGrants.join("\n"), /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES/);
  assert.match(runtimeGrants.join("\n"), /GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES/);
  assert.doesNotMatch(runtimeGrants.join("\n"), /GRANT CREATE|GRANT USAGE ON DATABASE|CREATEROLE|SUPERUSER/);
  assert.doesNotMatch(sql.join("\n"), new RegExp(`GRANT "${names.runtimeRole}" TO CURRENT_USER|ALTER ROLE "${names.runtimeRole}" (?:CREATEROLE|SUPERUSER)`));
});

test("provisioning temporarily grants the executor SET ROLE ability for the migration owner, then removes it", () => {
  const names = databaseNamesForDeployment("inventory", "deployment_a");
  const sql = databaseProvisionSql(names, { migration: "migration-secret", runtime: "runtime-secret" });
  const grant = `GRANT "${names.migrationRole}" TO CURRENT_USER;`;
  const revoke = `REVOKE "${names.migrationRole}" FROM CURRENT_USER;`;
  const grantIndex = sql.indexOf(grant);
  const ownerTransferIndex = sql.indexOf(`ALTER SCHEMA "${names.schema}" OWNER TO "${names.migrationRole}";`);
  const defaultPrivilegesIndex = sql.findIndex((statement) => statement.startsWith(`ALTER DEFAULT PRIVILEGES FOR ROLE "${names.migrationRole}"`));
  const revokeIndex = sql.indexOf(revoke);

  assert.ok(grantIndex >= 0, "executor receives membership needed to SET ROLE to the migration owner");
  assert.ok(grantIndex < ownerTransferIndex, "membership exists before schema ownership transfer");
  assert.ok(grantIndex < defaultPrivilegesIndex, "membership exists before migration-owner default privileges");
  assert.ok(revokeIndex > defaultPrivilegesIndex, "temporary membership is removed after provisioning");
});

test("failed provisioning best-effort revokes temporary migration-role membership", async () => {
  const names = databaseNamesForDeployment("inventory", "deployment_failure");
  const commands: string[] = [];
  await assert.rejects(() => provisionAppDatabase({ appId: "inventory", deploymentId: "deployment_failure", adminDatabaseUrl: "postgresql://admin:pw@db.example/platform" }, {
    executor: {
      execute: async (sql) => {
        commands.push(sql);
        if (sql.startsWith("ALTER SCHEMA")) throw new Error("must be able to SET ROLE");
      },
    },
    store: { get: async () => null, save: async () => undefined },
    encryptSecret: (value) => `cipher:${value.length}`,
    randomPassword: () => "generated-secret",
  }), /SET ROLE/);
  assert.equal(commands.at(-1), databaseMigrationExecutorRoleRevokeSql(names));
});

test("a retry after metadata persistence failed resets both pre-created role passwords", async () => {
  const commands: string[] = [];
  let saveAttempts = 0;
  let password = "first-secret";
  const dependencies = {
    executor: { execute: async (sql: string) => { commands.push(sql); } },
    store: {
      get: async () => null,
      save: async () => {
        saveAttempts += 1;
        if (saveAttempts === 1) throw new Error("metadata write interrupted");
      },
    },
    encryptSecret: (value: string) => `cipher:${value.length}`,
    randomPassword: () => password,
  };
  const input = { appId: "inventory", deploymentId: "partial_1", adminDatabaseUrl: "postgresql://admin:pw@db.example/p" };
  await assert.rejects(() => provisionAppDatabase(input, dependencies));
  password = "second-secret";
  const recovered = await provisionAppDatabase(input, dependencies);
  assert.match(recovered.migrationUrl, /second-secret/);
  assert.match(recovered.runtimeUrl, /second-secret/);
  const retrySql = commands.slice(commands.length / 2);
  assert.equal(retrySql.some((sql) => sql.startsWith("ALTER ROLE") && sql.includes("PASSWORD 'second-secret'")), true);
  assert.equal(retrySql.filter((sql) => sql.startsWith("ALTER ROLE") && sql.includes("PASSWORD 'second-secret'")).length, 2);
});

test("successful cutover closes stable migration login and only predecessor runtime login", async () => {
  const activeNames = databaseNamesForDeployment("inventory", "deployment_current");
  const predecessorNames = databaseNamesForDeployment("inventory", "deployment_old");
  const metadata = (names: typeof activeNames) => ({
    version: 2,
    appId: "inventory",
    schema: names.schema,
    migrationRole: names.migrationRole,
    runtimeRole: names.runtimeRole,
    migrationUrlCiphertext: "cipher:migration",
    runtimeUrlCiphertext: "cipher:runtime",
    runtimeCredentialVersion: 1,
    provisionedAt: "2026-07-22T00:00:00.000Z",
  });
  const commands: string[] = [];
  const result = await retireManagedDatabaseAccess({
    appId: "inventory",
    activeDeployment: { deploymentId: "deployment_current", databaseProvision: metadata(activeNames) },
    predecessorDeployments: [{ deploymentId: "deployment_old", databaseProvision: metadata(predecessorNames) }, { deploymentId: "identity_only", databaseProvision: null }],
  }, { execute: async (sql) => { commands.push(sql); } });
  assert.deepEqual(result, { retired: 1 });
  assert.deepEqual(commands, [
    `ALTER ROLE "${activeNames.migrationRole}" NOLOGIN;`,
    `ALTER ROLE "${predecessorNames.runtimeRole}" NOLOGIN;`,
  ]);
  assert.equal(commands.some((sql) => sql.includes(activeNames.runtimeRole)), false);
  assert.equal(commands.filter((sql) => sql.includes(activeNames.migrationRole)).length, 1);
  assert.equal(commands.some((sql) => /DROP|SCHEMA/i.test(sql)), false);
  await assert.rejects(() => retireManagedDatabaseAccess({
    appId: "inventory",
    activeDeployment: { deploymentId: "deployment_current", databaseProvision: metadata(activeNames) },
    predecessorDeployments: [{ deploymentId: "deployment_old", databaseProvision: { ...metadata(predecessorNames), runtimeRole: "attacker_role" } }],
  }, { execute: async () => undefined }), /does not match/);
});

test("role URLs preserve schema but are never returned by metadata/status", async () => {
  const saved: Record<string, unknown>[] = [];
  const commands: string[] = [];
  const result = await provisionAppDatabase({ appId: "inventory", deploymentId: "deployment_1", adminDatabaseUrl: "postgresql://admin:admin-secret@db.example/platform" }, {
    executor: { execute: async (sql) => { commands.push(sql); } },
    store: { get: async () => null, save: async (_id, data) => { saved.push(data); } },
    encryptSecret: (value) => `cipher:${Buffer.from(value).toString("base64")}`,
    randomPassword: () => "generated-secret",
    now: () => new Date("2026-07-22T00:00:00.000Z"),
  });
  assert.match(result.runtimeUrl, /schema=app_inventory_/);
  assert.equal(saved.length, 1);
  assert.doesNotMatch(JSON.stringify(saved[0]), /generated-secret|admin-secret|postgresql:\/\//);
  assert.ok(commands.length > 0);
  assert.equal(databaseUrlForRole("postgresql://a:b@db.example/p", "role", "pw", "schema").includes("schema=schema"), true);
});

test("replay is idempotent and rotation changes only the runtime credential", async () => {
  const commands: string[] = [];
  const saves: Record<string, unknown>[] = [];
  const prior = {
    version: 2, appId: "inventory", schema: databaseNamesForDeployment("inventory", "deployment_1").schema,
    migrationRole: databaseNamesForDeployment("inventory", "deployment_1").migrationRole, runtimeRole: databaseNamesForDeployment("inventory", "deployment_1").runtimeRole,
    migrationUrlCiphertext: "cipher:old-migration", runtimeUrlCiphertext: "cipher:old-runtime", runtimeCredentialVersion: 1, provisionedAt: "2026-01-01T00:00:00.000Z",
  };
  const deps = {
    executor: { execute: async (sql: string) => { commands.push(sql); } },
    store: { get: async () => ({ databaseProvision: prior }), save: async (_id: string, data: Record<string, unknown>) => { saves.push(data); } },
    encryptSecret: (value: string) => `cipher:${value.length}`,
    decryptSecret: (value: string) => value === "cipher:old-migration" ? "postgresql://migration:old@db.example/p?schema=app_inventory" : "postgresql://runtime:old@db.example/p?schema=app_inventory",
    randomPassword: () => "rotated-secret",
  };
  const replay = await provisionAppDatabase({ appId: "inventory", deploymentId: "deployment_1", adminDatabaseUrl: "postgresql://admin:pw@db.example/p" }, deps);
  assert.match(replay.runtimeUrl, /^postgresql:\/\/runtime:old@/);
  assert.match(replay.migrationUrl, /^postgresql:\/\/migration:old@/);
  assert.equal(commands.length, 0);
  const rotated = await provisionAppDatabase({ appId: "inventory", deploymentId: "deployment_1", adminDatabaseUrl: "postgresql://admin:pw@db.example/p", rotateRuntimeCredentials: true }, deps);
  assert.equal(rotated.rotated, true);
  assert.equal(commands.length, 1);
  assert.match(commands[0], /^ALTER ROLE /);
  assert.equal(saves.length, 1);
  assert.doesNotMatch(JSON.stringify(saves[0]), /rotated-secret|postgresql:\/\//);
});

test("a second deployment shares schema but creates effective independent credentials", async () => {
  const commands: string[] = [];
  const store = { get: async () => null, save: async () => undefined };
  const base = { appId: "inventory", adminDatabaseUrl: "postgresql://admin:admin@db.example/p" };
  const first = await provisionAppDatabase({ ...base, deploymentId: "deployment_a" }, { executor: { execute: async (sql) => { commands.push(sql); } }, store, encryptSecret: (value) => `cipher:${value.length}`, randomPassword: () => "first-secret" });
  const second = await provisionAppDatabase({ ...base, deploymentId: "deployment_b" }, { executor: { execute: async (sql) => { commands.push(sql); } }, store, encryptSecret: (value) => `cipher:${value.length}`, randomPassword: () => "second-secret" });
  assert.equal(first.names.schema, second.names.schema);
  assert.equal(first.names.migrationRole, second.names.migrationRole);
  assert.notEqual(first.names.runtimeRole, second.names.runtimeRole);
  assert.match(first.runtimeUrl, /first-secret/);
  assert.match(second.runtimeUrl, /second-secret/);
  assert.match(commands.join("\n"), /first-secret/);
  assert.match(commands.join("\n"), /second-secret/);
});
