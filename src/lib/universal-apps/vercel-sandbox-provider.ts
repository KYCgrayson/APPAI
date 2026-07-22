import { createHash } from "node:crypto";

import { isAllowedSourceRepositoryUrl, universalAppManifestSchema, type UniversalAppManifest } from "./manifest.ts";
import { assertReleasePackageDigest, inspectReleasePackageArchive } from "./release-package-archive.ts";

export type SandboxCommand = { cmd: string; args: string[]; cwd?: string; env?: Record<string, string> };
export type SandboxRun = {
  run(command: SandboxCommand): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  /** Required for immutable package sources; the production adapter writes the
   * bytes directly and never exposes storage credentials to the sandbox. */
  writeFiles?(files: Array<{ path: string; content: Uint8Array }>): Promise<void>;
  /** The concrete platform adapter supplies this; test doubles may omit it. */
  stop?(): Promise<void>;
};
export type RepositoryReleaseSource = { type: "repository"; repoUrl: string; revision: string };
export type PackageReleaseSource = { type: "package"; bytes: Uint8Array; digest: string };
export type ImmutableReleaseSource = RepositoryReleaseSource | PackageReleaseSource;
export type SandboxFactory = { create(input: { phase: "validation" | "provider" | "migration"; source?: { repoUrl: string; revision: string }; persistent: false; timeoutMs: number; tags: Record<string, string> }): Promise<SandboxRun> };

export type ReleaseSnapshot = { appId: string; version: string; source: ImmutableReleaseSource; manifest: unknown };

const SHA = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;
const VERCEL_CLI = "vercel@56.4.1";
const PROVIDER_TOOLS_DIR = "/tmp/appai-provider";
const PROVIDER_CLI = `${PROVIDER_TOOLS_DIR}/node_modules/.bin/vercel`;
const SECRET = /(postgres(?:ql)?:\/\/\S+|DATABASE_URL=\S+|VERCEL_OIDC_TOKEN=\S+)/gi;
export const redactProviderLog = (value: string) => value.replace(SECRET, "[redacted]").slice(0, 2000);

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("MANIFEST_MISMATCH");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new Error("MANIFEST_MISMATCH");
}

function parseManifest(value: unknown): UniversalAppManifest {
  const parsed = universalAppManifestSchema.safeParse(value);
  if (!parsed.success) throw new Error("MANIFEST_MISMATCH");
  return parsed.data;
}

export function assertPinnedSnapshot(snapshot: ReleaseSnapshot) {
  if (snapshot.source.type === "repository") {
    if (!SHA.test(snapshot.source.revision)) throw new Error("SOURCE_REVISION_MUST_BE_EXACT_SHA");
    if (!isAllowedSourceRepositoryUrl(snapshot.source.repoUrl)) throw new Error("INVALID_REPOSITORY_URL");
    return;
  }
  assertReleasePackageDigest(snapshot.source.bytes, snapshot.source.digest);
  inspectReleasePackageArchive(snapshot.source.bytes);
}

function sandboxSource(source: ImmutableReleaseSource) {
  return source.type === "repository" ? { repoUrl: source.repoUrl, revision: source.revision } : undefined;
}

/** Hydrates a pre-validated immutable package into an otherwise empty sandbox. */
export async function hydratePackageSource(sandbox: SandboxRun, source: ImmutableReleaseSource) {
  if (source.type !== "package") return;
  // Recheck immediately before the bytes cross the isolation boundary. This
  // binds each validation/migration/provider phase to the same immutable blob.
  assertReleasePackageDigest(source.bytes, source.digest);
  inspectReleasePackageArchive(source.bytes);
  if (!sandbox.writeFiles) throw new Error("SANDBOX_PACKAGE_WRITE_UNAVAILABLE");
  await sandbox.writeFiles([{ path: "/tmp/appai-release.tgz", content: source.bytes }]);
  const extracted = await sandbox.run({
    cmd: "tar",
    args: [
      "--extract", "--gzip", "--file=/tmp/appai-release.tgz", "--directory=/vercel/sandbox",
      "--no-same-owner", "--no-same-permissions", "--numeric-owner", "--no-overwrite-dir",
    ],
  });
  if (extracted.exitCode) throw new Error("PACKAGE_ARCHIVE_EXTRACTION_FAILED");
}

/** Validates the full manifest from source against the canonical stored snapshot. */
export function parseValidatedManifest(value: string, snapshot: ReleaseSnapshot) {
  let repositoryManifest: unknown;
  try {
    repositoryManifest = JSON.parse(value);
  } catch {
    throw new Error("MANIFEST_MISMATCH");
  }
  const source = parseManifest(repositoryManifest);
  const stored = parseManifest(snapshot.manifest);
  if (source.id !== snapshot.appId || stored.id !== snapshot.appId || source.version !== snapshot.version || stored.version !== snapshot.version || canonicalJson(source) !== canonicalJson(stored)) {
    throw new Error("MANIFEST_MISMATCH");
  }
  // Evidence is bound to the immutable checkout identity as well as the
  // reviewed manifest. Two revisions with identical manifests are different
  // executable artifacts and must never share an activation digest.
  // Keep repository evidence byte-for-byte compatible with existing managed
  // releases. Package evidence binds the uploaded archive digest to precisely
  // the same reviewed manifest without introducing a repository dependency.
  const evidence = snapshot.source.type === "repository"
    ? { repoUrl: snapshot.source.repoUrl, sourceRevision: snapshot.source.revision.toLowerCase(), manifest: source }
    : { packageDigest: snapshot.source.digest.toLowerCase(), manifest: source };
  return `sha256:${createHash("sha256").update(canonicalJson(evidence)).digest("hex")}`;
}

export function assertProviderUrl(value: string, appId: string) {
  const url = new URL(value);
  const escaped = appId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (url.protocol !== "https:" || url.username || url.password || !new RegExp(`^appai-app-${escaped}\\.vercel\\.app$`).test(url.hostname)) throw new Error("PROVIDER_URL_OWNERSHIP_MISMATCH");
  return url.origin;
}

export function assertManagedRuntimeUrl(value: string, appId: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hostname !== `${appId}.appai.info`) {
    throw new Error("MANAGED_RUNTIME_URL_OWNERSHIP_MISMATCH");
  }
  return url.origin;
}

function commandArgv(command: string) {
  // The manifest schema permits only space-delimited package-manager commands.
  return command.split(" ").filter(Boolean);
}

function packageManager(manifest: UniversalAppManifest) {
  return commandArgv(manifest.runtime.installCommand)[0];
}

function projectRecords(value: string): Array<{ name: string; id: string }> {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("INVALID_PROVIDER_RESPONSE"); }
  const entries = Array.isArray(parsed) ? parsed : (parsed as { projects?: unknown })?.projects;
  if (!Array.isArray(entries)) throw new Error("INVALID_PROVIDER_RESPONSE");
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const project = entry as { name?: unknown; id?: unknown };
    return typeof project.name === "string" && typeof project.id === "string" ? [{ name: project.name, id: project.id }] : [];
  });
}

function normalizedAliasHostname(value: string) {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.hostname.toLowerCase();
  } catch {
    throw new Error("INVALID_PROVIDER_RESPONSE");
  }
}

function validatedDeploymentUrl(value: string) {
  const lines = value.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) throw new Error("INVALID_PROVIDER_RESPONSE");
  try {
    const url = new URL(lines[0]);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !url.hostname.endsWith(".vercel.app")) throw new Error();
    return url.origin;
  } catch {
    throw new Error("INVALID_PROVIDER_RESPONSE");
  }
}

function inspectRecord(value: string): { id: string; readyState: string; aliases: string[] } {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("INVALID_PROVIDER_RESPONSE"); }
  const record = parsed as { id?: unknown; readyState?: unknown; aliases?: unknown; alias?: unknown };
  const aliases = Array.isArray(record.aliases) ? record.aliases : Array.isArray(record.alias) ? record.alias : [];
  if (typeof record.id !== "string" || typeof record.readyState !== "string" || !aliases.every((alias) => typeof alias === "string")) throw new Error("INVALID_PROVIDER_RESPONSE");
  return { id: record.id, readyState: record.readyState, aliases: (aliases as string[]).map(normalizedAliasHostname) };
}

async function inspectAliasedDeployment(
  sandbox: SandboxRun,
  env: Record<string, string>,
  project: string,
  appId: string,
  wait: (ms: number) => Promise<void>,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const inspected = await sandbox.run({ cmd: "sh", args: ["-c", `${PROVIDER_CLI} inspect "$APPAI_DEPLOYMENT_URL" --json`], env });
      if (inspected.exitCode) throw new Error(redactProviderLog(inspected.stderr || inspected.stdout));
      const inspect = inspectRecord(inspected.stdout);
      if (inspect.readyState !== "READY" || !inspect.aliases.includes(`${project}.vercel.app`) || !inspect.aliases.includes(`${appId}.appai.info`)) {
        throw new Error("INVALID_PROVIDER_RESPONSE");
      }
      return inspect;
    } catch (error) {
      lastError = error;
      if (attempt < 11) await wait(1_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("INVALID_PROVIDER_RESPONSE");
}

export async function validateRelease(factory: SandboxFactory, snapshot: ReleaseSnapshot) {
  assertPinnedSnapshot(snapshot);
  const source = sandboxSource(snapshot.source);
  const sandbox = await factory.create({ phase: "validation", ...(source ? { source } : {}), persistent: false, timeoutMs: 10 * 60_000, tags: { appId: snapshot.appId, phase: "validation" } });
  try {
    await hydratePackageSource(sandbox, snapshot.source);
    const manifest = await sandbox.run({ cmd: "cat", args: ["appai.app.json"] });
    if (manifest.exitCode) throw new Error(redactProviderLog(manifest.stderr));
    const manifestDigest = parseValidatedManifest(manifest.stdout, snapshot);
    const parsedManifest = parseManifest(JSON.parse(manifest.stdout));
    const manager = packageManager(parsedManifest);
    const commands = [
      commandArgv(parsedManifest.runtime.installCommand),
      [manager, "test"],
      [manager, "run", "typecheck"],
      commandArgv(parsedManifest.runtime.buildCommand),
    ];
    for (const [cmd, ...args] of commands) {
      const result = await sandbox.run({ cmd, args });
      if (result.exitCode) throw new Error(redactProviderLog(result.stderr || result.stdout));
    }
    return { manifestDigest };
  } finally {
    await sandbox.stop?.();
  }
}

export async function deployValidatedRelease(factory: SandboxFactory, input: { appId: string; source: ImmutableReleaseSource; oidcToken: string; platformUrl: string; databaseUrl?: string; inspectWait?: (ms: number) => Promise<void> }) {
  assertPinnedSnapshot({ appId: input.appId, version: "0.0.0", source: input.source, manifest: {} });
  const source = sandboxSource(input.source);
  const sandbox = await factory.create({ phase: "provider", ...(source ? { source } : {}), persistent: false, timeoutMs: 10 * 60_000, tags: { appId: input.appId, phase: "provider" } });
  const env = {
    VERCEL_OIDC_TOKEN: input.oidcToken,
    APPAI_PROJECT: `appai-app-${input.appId}`,
    APPAI_RUNTIME_HOST: `${input.appId}.appai.info`,
  };
  const runtimeEnv = {
    ...env,
    APPAI_PLATFORM_URL: input.platformUrl,
    APPAI_APP_ID: input.appId,
    ...(input.databaseUrl ? { DATABASE_URL: input.databaseUrl } : {}),
  };
  const project = `appai-app-${input.appId}`;
  // Install outside the application checkout so repository npm configuration and
  // lifecycle scripts cannot influence the privileged provider CLI.
  try {
    await hydratePackageSource(sandbox, input.source);
    const tools = await sandbox.run({ cmd: "npm", args: ["install", "--prefix", PROVIDER_TOOLS_DIR, "--ignore-scripts", VERCEL_CLI], cwd: "/tmp" });
    if (tools.exitCode) throw new Error(redactProviderLog(tools.stderr || tools.stdout));
    const trusted = async (script: string) => sandbox.run({ cmd: "sh", args: ["-c", script], env });
    const created = await trusted(`${PROVIDER_CLI} project add "$APPAI_PROJECT" --non-interactive`);
    const projects = await trusted(`${PROVIDER_CLI} project ls --json --filter "$APPAI_PROJECT" --limit 100`);
    if (projects.exitCode) throw new Error(redactProviderLog(projects.stderr || projects.stdout));
    const projectId = projectRecords(projects.stdout).find((item) => item.name === project)?.id;
  // `project add` may report an existing project; accept it only after the
  // authenticated CLI project list proves ownership in this account/team.
    const alreadyExists = /already exists|already.*project/i.test(`${created.stdout}\n${created.stderr}`);
    if (!projectId || (created.exitCode && !alreadyExists)) throw new Error(redactProviderLog(created.stderr || created.stdout));

    const databaseRuntimeArgument = input.databaseUrl ? ' --env "DATABASE_URL=$DATABASE_URL"' : "";
    const deployed = await sandbox.run({ cmd: "sh", args: ["-c", `${PROVIDER_CLI} deploy --prod --yes --project "$APPAI_PROJECT"${databaseRuntimeArgument} --env "APPAI_PLATFORM_URL=$APPAI_PLATFORM_URL" --env "APPAI_APP_ID=$APPAI_APP_ID"`], env: runtimeEnv });
    if (deployed.exitCode) throw new Error(redactProviderLog(deployed.stderr || deployed.stdout));
    const deployedUrl = validatedDeploymentUrl(deployed.stdout);
    const aliased = await sandbox.run({ cmd: "sh", args: ["-c", `${PROVIDER_CLI} alias set "$APPAI_DEPLOYMENT_URL" "$APPAI_RUNTIME_HOST"`], env: { ...env, APPAI_DEPLOYMENT_URL: deployedUrl } });
    if (aliased.exitCode) throw new Error(redactProviderLog(aliased.stderr || aliased.stdout));
    const inspect = await inspectAliasedDeployment(
      sandbox,
      { ...env, APPAI_DEPLOYMENT_URL: deployedUrl },
      project,
      input.appId,
      input.inspectWait ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms))),
    );
    assertProviderUrl(`https://${project}.vercel.app`, input.appId);
    const publicRuntimeUrl = assertManagedRuntimeUrl(`https://${input.appId}.appai.info`, input.appId);
    return { providerProjectId: projectId, providerDeploymentId: inspect.id, publicRuntimeUrl };
  } finally {
    await sandbox.stop?.();
  }
}
