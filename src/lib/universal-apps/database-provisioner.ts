import { createHash, randomBytes } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

export type DatabaseSqlExecutor = {
  execute(sql: string): Promise<void>;
  disconnect?(): Promise<void>;
};

export type DatabaseProvisionRecord = {
  databaseProvision: unknown;
};

export type DatabaseProvisionStore = {
  get(deploymentId: string): Promise<DatabaseProvisionRecord | null>;
  save(deploymentId: string, databaseProvision: Record<string, unknown>): Promise<void>;
};

export type AppDatabaseNames = {
  schema: string;
  migrationRole: string;
  runtimeRole: string;
};

type ProvisionMetadata = {
  version: 2;
  appId: string;
  schema: string;
  migrationRole: string;
  runtimeRole: string;
  migrationUrlCiphertext: string;
  runtimeUrlCiphertext: string;
  runtimeCredentialVersion: number;
  provisionedAt: string;
  rotatedAt?: string;
};

export type AppDatabaseProvision = {
  appId: string;
  names: AppDatabaseNames;
  migrationUrl: string;
  runtimeUrl: string;
  rotated: boolean;
};

export type ManagedDatabaseRetirementRecord = {
  deploymentId: string;
  databaseProvision: unknown;
};

export type DatabaseProvisionerDependencies = {
  executor: DatabaseSqlExecutor;
  store: DatabaseProvisionStore;
  encryptSecret?: (value: string) => string;
  decryptSecret?: (value: string) => string;
  randomPassword?: () => string;
  now?: () => Date;
};

const identifierLimit = 63;

function quotedIdentifier(value: string) {
  // Names are derived below, not supplied by a caller. Keep quoting here as a
  // defense-in-depth guard if this module is refactored.
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) throw new Error("Invalid generated database identifier.");
  return `"${value}"`;
}

function quotedLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function generatedPassword() {
  return randomBytes(32).toString("base64url");
}

function compactIdentifier(prefix: string, label: string, hashInput: string, suffix: string) {
  const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 10);
  const available = identifierLimit - prefix.length - suffix.length - hash.length - 1;
  return `${prefix}${label.slice(0, available)}_${hash}${suffix}`;
}

/**
 * The schema and migration owner are stable per app. PostgreSQL objects stay
 * owned by that migration role across blue/green releases, so a later
 * migration can alter tables created by an earlier release. Runtime roles are
 * deployment-specific and are the only credentials retained by a live app.
 */
export function databaseNamesForDeployment(appIdInput: string, deploymentId: string): AppDatabaseNames {
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(appIdInput)) throw new Error("Invalid app id.");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(deploymentId)) throw new Error("Invalid deployment id.");
  const appId = appIdInput;
  const identifierLabel = appId.replaceAll("-", "_");
  return {
    schema: compactIdentifier("app_", identifierLabel, appId, ""),
    migrationRole: compactIdentifier("app_", identifierLabel, appId, "_m"),
    runtimeRole: compactIdentifier("app_", identifierLabel, `${appId}:${deploymentId}`, "_r"),
  };
}

export function databaseUrlForRole(adminDatabaseUrl: string, role: string, password: string, schema: string) {
  const url = new URL(adminDatabaseUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Database administrator URL must use PostgreSQL.");
  url.username = role;
  url.password = password;
  url.searchParams.set("schema", schema);
  return url.toString();
}

/**
 * Administrative executor for DATABASE_URL_UNPOOLED. `$executeRawUnsafe` is
 * confined to SQL emitted by `databaseProvisionSql`; no caller SQL enters it.
 */
export function createPrismaAdminSqlExecutor(adminDatabaseUrl: string): DatabaseSqlExecutor {
  const url = new URL(adminDatabaseUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Database administrator URL must use PostgreSQL.");
  const client = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });
  return {
    execute: async (sql) => { await client.$executeRawUnsafe(sql); },
    disconnect: async () => { await client.$disconnect(); },
  };
}

export function databaseProvisionSql(names: AppDatabaseNames, passwords: { migration: string; runtime: string }) {
  const schema = quotedIdentifier(names.schema);
  const migrationRole = quotedIdentifier(names.migrationRole);
  const runtimeRole = quotedIdentifier(names.runtimeRole);
  return [
    `DO $$ BEGIN CREATE ROLE ${migrationRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD ${quotedLiteral(passwords.migration)}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN CREATE ROLE ${runtimeRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD ${quotedLiteral(passwords.runtime)}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    // A metadata write can fail after role creation.  On the next trusted
    // attempt the CREATE statements above take the duplicate branch, so reset
    // both passwords explicitly before returning new credentials.
    `ALTER ROLE ${migrationRole} LOGIN PASSWORD ${quotedLiteral(passwords.migration)};`,
    `ALTER ROLE ${runtimeRole} LOGIN PASSWORD ${quotedLiteral(passwords.runtime)};`,
    `CREATE SCHEMA IF NOT EXISTS ${schema} AUTHORIZATION ${migrationRole};`,
    `ALTER SCHEMA ${schema} OWNER TO ${migrationRole};`,
    `ALTER ROLE ${migrationRole} SET search_path = ${schema};`,
    `ALTER ROLE ${runtimeRole} SET search_path = ${schema};`,
    `REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC;`,
    `GRANT USAGE ON SCHEMA ${schema} TO ${runtimeRole};`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${runtimeRole};`,
    `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA ${schema} TO ${runtimeRole};`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrationRole} IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${runtimeRole};`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${migrationRole} IN SCHEMA ${schema} GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${runtimeRole};`,
  ];
}

export function databaseRuntimeRotationSql(names: AppDatabaseNames, runtimePassword: string) {
  return `ALTER ROLE ${quotedIdentifier(names.runtimeRole)} PASSWORD ${quotedLiteral(runtimePassword)};`;
}

export function databaseMigrationRoleClosureSql(names: AppDatabaseNames) {
  return `ALTER ROLE ${quotedIdentifier(names.migrationRole)} NOLOGIN;`;
}

export function databaseRuntimeRetirementSql(names: AppDatabaseNames) {
  return `ALTER ROLE ${quotedIdentifier(names.runtimeRole)} NOLOGIN;`;
}

function parseMetadata(value: unknown): ProvisionMetadata | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ProvisionMetadata>;
  return candidate.version === 2 && typeof candidate.appId === "string" && typeof candidate.schema === "string" &&
    typeof candidate.migrationRole === "string" && typeof candidate.runtimeRole === "string" &&
    typeof candidate.migrationUrlCiphertext === "string" && typeof candidate.runtimeUrlCiphertext === "string" &&
    typeof candidate.runtimeCredentialVersion === "number" && typeof candidate.provisionedAt === "string"
    ? candidate as ProvisionMetadata : null;
}

/**
 * Removes login access from an old deployment without dropping its schema or
 * data. Metadata is treated as hostile storage: role names must exactly match
 * the deterministic names for this app and deployment before SQL is emitted.
 *
 * This is intentionally run by the trusted platform transaction only after a
 * replacement runtime has passed health verification and is being activated.
 */
export async function retireManagedDatabaseAccess(input: {
  appId: string;
  activeDeployment: ManagedDatabaseRetirementRecord;
  predecessorDeployments: readonly ManagedDatabaseRetirementRecord[];
}, executor: DatabaseSqlExecutor) {
  const appId = universalAppId(input.appId);
  const validate = (deployment: ManagedDatabaseRetirementRecord) => {
    const metadata = parseMetadata(deployment.databaseProvision);
    if (!metadata) {
      if (deployment.databaseProvision == null) return null;
      throw new Error("Invalid managed database metadata for retirement.");
    }
    const expected = databaseNamesForDeployment(appId, deployment.deploymentId);
    if (metadata.appId !== appId || metadata.schema !== expected.schema ||
        metadata.migrationRole !== expected.migrationRole || metadata.runtimeRole !== expected.runtimeRole) {
      throw new Error("Managed database metadata does not match the retired deployment.");
    }
    return expected;
  };

  // The stable migration owner is not needed by the active runtime. Close its
  // login after every successful activation (including the first deployment).
  // The next trusted provisioning run explicitly re-enables it with a fresh
  // password before running migrations.
  const activeNames = validate(input.activeDeployment);
  if (activeNames) await executor.execute(databaseMigrationRoleClosureSql(activeNames));

  let retired = 0;
  for (const deployment of input.predecessorDeployments) {
    const names = validate(deployment);
    // The predecessor's migration role is the same stable owner used by the
    // active deployment. Retire only its runtime login.
    if (!names) continue;
    await executor.execute(databaseRuntimeRetirementSql(names));
    retired += 1;
  }
  return { retired };
}

function universalAppId(value: string) {
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(value)) throw new Error("Invalid app id.");
  return value;
}

export function prismaManagedRuntimeStore(): DatabaseProvisionStore {
  return {
    async get(deploymentId) {
      const { db } = await import("@/lib/db");
      return db.appManagedRuntime.findUnique({ where: { appDeploymentId: deploymentId }, select: { databaseProvision: true } });
    },
    async save(deploymentId, databaseProvision) {
      const { db } = await import("@/lib/db");
      await db.appManagedRuntime.upsert({
        where: { appDeploymentId: deploymentId },
        create: { appDeploymentId: deploymentId, databaseProvision: databaseProvision as Prisma.InputJsonValue },
        update: { databaseProvision: databaseProvision as Prisma.InputJsonValue },
      });
    },
  };
}

/**
 * Creates one schema and two least-privilege roles for a validated app. The
 * cleartext URLs exist only in this return value for the trusted deployer;
 * persisted metadata contains ciphertext, never URLs/passwords in cleartext.
 */
export async function provisionAppDatabase(input: {
  appId: string;
  deploymentId: string;
  adminDatabaseUrl?: string;
  rotateRuntimeCredentials?: boolean;
}, dependencies: DatabaseProvisionerDependencies): Promise<AppDatabaseProvision> {
  const appId = universalAppId(input.appId);
  const adminDatabaseUrl = input.adminDatabaseUrl || process.env.DATABASE_URL_UNPOOLED;
  if (!adminDatabaseUrl) throw new Error("Database provisioning is not configured.");
  const names = databaseNamesForDeployment(appId, input.deploymentId);
  const existing = parseMetadata((await dependencies.store.get(input.deploymentId))?.databaseProvision);
  const now = (dependencies.now || (() => new Date()))().toISOString();
  const makePassword = dependencies.randomPassword || generatedPassword;
  const encryptSecret = dependencies.encryptSecret || (await import("@/lib/encryption")).encrypt;

  if (existing && !input.rotateRuntimeCredentials) {
    if (existing.appId !== appId || existing.schema !== names.schema || existing.runtimeRole !== names.runtimeRole || existing.migrationRole !== names.migrationRole) {
      throw new Error("Managed database metadata does not match this app.");
    }
    const decryptSecret = dependencies.decryptSecret || (await import("@/lib/encryption")).decrypt;
    // Idempotent replays do not recreate roles, but the trusted deployer still
    // needs the encrypted deployment credentials to reconcile safely.
    return {
      appId,
      names,
      migrationUrl: decryptSecret(existing.migrationUrlCiphertext),
      runtimeUrl: decryptSecret(existing.runtimeUrlCiphertext),
      rotated: false,
    };
  }

  const migrationPassword = existing ? "" : makePassword();
  const runtimePassword = makePassword();
  const migrationUrl = existing ? "" : databaseUrlForRole(adminDatabaseUrl, names.migrationRole, migrationPassword, names.schema);
  const runtimeUrl = databaseUrlForRole(adminDatabaseUrl, names.runtimeRole, runtimePassword, names.schema);

  if (existing) {
    await dependencies.executor.execute(databaseRuntimeRotationSql(names, runtimePassword));
  } else {
    for (const statement of databaseProvisionSql(names, { migration: migrationPassword, runtime: runtimePassword })) {
      await dependencies.executor.execute(statement);
    }
  }

  const metadata: ProvisionMetadata = {
    version: 2,
    appId,
    schema: names.schema,
    migrationRole: names.migrationRole,
    runtimeRole: names.runtimeRole,
    migrationUrlCiphertext: existing?.migrationUrlCiphertext || encryptSecret(migrationUrl),
    runtimeUrlCiphertext: encryptSecret(runtimeUrl),
    runtimeCredentialVersion: (existing?.runtimeCredentialVersion || 0) + (existing ? 1 : 1),
    provisionedAt: existing?.provisionedAt || now,
    ...(existing ? { rotatedAt: now } : {}),
  };
  await dependencies.store.save(input.deploymentId, metadata);
  return { appId, names, migrationUrl, runtimeUrl, rotated: Boolean(existing) };
}

/** Uses DATABASE_URL_UNPOOLED only for the platform-controlled provisioning transaction. */
export async function provisionAppDatabaseFromEnvironment(input: {
  appId: string;
  deploymentId: string;
  rotateRuntimeCredentials?: boolean;
}) {
  const adminDatabaseUrl = process.env.DATABASE_URL_UNPOOLED;
  if (!adminDatabaseUrl) throw new Error("Database provisioning is not configured.");
  const executor = createPrismaAdminSqlExecutor(adminDatabaseUrl);
  try {
    return await provisionAppDatabase({ ...input, adminDatabaseUrl }, {
      executor,
      store: prismaManagedRuntimeStore(),
    });
  } finally {
    await executor.disconnect?.();
  }
}
