import { Sandbox, type NetworkPolicy } from "@vercel/sandbox";

import type { UniversalAppManifest } from "./manifest.ts";
import {
  redactProviderLog,
  type SandboxCommand,
  type SandboxFactory,
  type ImmutableReleaseSource,
  type SandboxRun,
  hydratePackageSource,
} from "./vercel-sandbox-provider.ts";

type VercelSandbox = {
  runCommand(input: { cmd: string; args?: string[]; cwd?: string; env?: Record<string, string> }): Promise<{
    exitCode: number | null;
    stdout(): Promise<string>;
    stderr(): Promise<string>;
  }>;
  stop(input?: { blocking?: boolean }): Promise<unknown>;
  updateNetworkPolicy(policy: NetworkPolicy): Promise<unknown>;
  writeFiles(files: Array<{ path: string; content: Uint8Array }>): Promise<void>;
};

export type MigrationSandboxRun = SandboxRun & {
  restrictNetworkTo(hostname: string): Promise<void>;
};

export type MigrationSandboxFactory = {
  create(input: Parameters<SandboxFactory["create"]>[0]): Promise<MigrationSandboxRun>;
};

function asResult(command: { exitCode: number | null; stdout(): Promise<string>; stderr(): Promise<string> }) {
  return Promise.all([command.stdout(), command.stderr()]).then(([stdout, stderr]) => ({
    exitCode: command.exitCode ?? 1,
    stdout,
    stderr,
  }));
}

function toRun(sandbox: VercelSandbox): MigrationSandboxRun {
  return {
    async run(command: SandboxCommand) {
      return asResult(await sandbox.runCommand({
        cmd: command.cmd,
        args: command.args,
        ...(command.cwd ? { cwd: command.cwd } : {}),
        ...(command.env ? { env: command.env } : {}),
      }));
    },
    async restrictNetworkTo(hostname: string) {
      if (!hostname || hostname.includes(":")) throw new Error("INVALID_DATABASE_HOST");
      // This policy is applied only after the untrusted dependency install. The
      // migration command can reach exactly the database host, not npm, Vercel,
      // or arbitrary application-controlled destinations.
      await sandbox.updateNetworkPolicy({ allow: [hostname] });
    },
    async writeFiles(files) {
      await sandbox.writeFiles(files);
    },
    async stop() {
      await sandbox.stop({ blocking: true });
    },
  };
}

/**
 * Production adapter. Repository sources use an exact git revision. Package
 * sources start empty and are written by AppAI after digest/archive validation;
 * phase tags are operational metadata only and never influence source/env.
 */
export function createVercelSandboxFactory(): MigrationSandboxFactory {
  return {
    async create(input) {
      const source = input.source
        ? { type: "git" as const, url: input.source.repoUrl, revision: input.source.revision, depth: 1 }
        : undefined;
      const sandbox = await Sandbox.create({
        ...(source ? { source } : {}),
        timeout: input.timeoutMs,
        runtime: "node22",
        resources: { vcpus: 2 },
        // Validation and provider setup need package/git/provider egress. The
        // migration runner narrows this policy before it receives DB credentials.
        networkPolicy: "allow-all",
      });
      return toRun(sandbox as unknown as VercelSandbox);
    },
  };
}

function commandArgv(command: string) {
  return command.split(" ").filter(Boolean);
}

/**
 * Runs immutable-source migrations with an app-scoped migration URL. Dependencies
 * are installed before the URL exists in the sandbox, then network egress is
 * narrowed to the database host and no provider credential is ever supplied.
 */
export async function runIsolatedMigration(
  factory: MigrationSandboxFactory,
  input: { appId: string; source: ImmutableReleaseSource; manifest: UniversalAppManifest; migrationUrl: string },
) {
  const migrationCommand = input.manifest.runtime.migrationCommand;
  if (!migrationCommand) return;
  const dbUrl = new URL(input.migrationUrl);
  if (!dbUrl.hostname || (dbUrl.protocol !== "postgres:" && dbUrl.protocol !== "postgresql:")) {
    throw new Error("INVALID_MIGRATION_DATABASE_URL");
  }
  const sandbox = await factory.create({
    phase: "migration",
    ...(input.source.type === "repository" ? { source: { repoUrl: input.source.repoUrl, revision: input.source.revision } } : {}),
    persistent: false,
    timeoutMs: 10 * 60_000,
    tags: { appId: input.appId, phase: "migration" },
  });
  try {
    await hydratePackageSource(sandbox, input.source);
    const [installCmd, ...installArgs] = commandArgv(input.manifest.runtime.installCommand);
    const installed = await sandbox.run({ cmd: installCmd, args: installArgs });
    if (installed.exitCode) throw new Error(redactProviderLog(installed.stderr || installed.stdout));

    await sandbox.restrictNetworkTo(dbUrl.hostname);
    const [migrationCmd, ...migrationArgs] = commandArgv(migrationCommand);
    const migrated = await sandbox.run({
      cmd: migrationCmd,
      args: migrationArgs,
      // The URL is process-only: it is not persisted, returned, or included in
      // a command argument visible to repository-controlled shell expansion.
      env: { DATABASE_URL: input.migrationUrl },
    });
    if (migrated.exitCode) throw new Error(redactProviderLog(migrated.stderr || migrated.stdout));
  } finally {
    await sandbox.stop?.();
  }
}
