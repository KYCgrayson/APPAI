import { z } from "zod";

export const UNIVERSAL_APP_CAPABILITIES = [
  "identity",
  "database",
  "private-assets",
] as const;

// These are the categories AppAI presents to publishers and in the public
// directory. The release contract deliberately remains compatible with any
// valid uppercase category value so existing integrations are not narrowed.
export const UNIVERSAL_APP_CATEGORIES = [
  "WRITING",
  "CODING",
  "DESIGN",
  "AUTOMATION",
  "PRODUCTIVITY",
  "SOCIAL",
  "FINANCE",
  "HEALTH",
  "EDUCATION",
  "FOOD",
  "TRAVEL",
  "ENTERTAINMENT",
  "GAMES",
  "MEDIA",
  "UTILITIES",
  "COMMERCE",
  "INVENTORY",
  "OTHER",
] as const;

const reservedAppHosts = new Set(["www", "api", "admin", "auth", "login", "dashboard", "mail"]);
export const universalAppIdSchema = z.string().regex(/^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])$/).refine(
  (value) => !reservedAppHosts.has(value),
  "This app id is reserved by the AppAI platform.",
);
const packageScriptCommand = z.string().regex(/^(npm|pnpm|yarn) (run )?[A-Za-z0-9:_-]+$/);

export function isAllowedSourceRepositoryUrl(value: string) {
  try {
    const url = new URL(value);
    // Public GitHub is the supported source host for managed checkouts. This
    // intentionally excludes localhost, IP literals, internal DNS and arbitrary
    // HTTPS targets from the sandbox source boundary.
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.toLowerCase() === "github.com" && url.pathname.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}
const credentialFreeHttpsUrl = z.url().max(500).refine(isAllowedSourceRepositoryUrl, "Repository URL must be a credential-free public GitHub repository URL.");

export const universalAppManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: universalAppIdSchema,
  name: z.string().trim().min(1).max(120),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  runtime: z.object({
    type: z.enum(["node"]),
    // Validation/migration must be reproducible from a checked-in lockfile.
    installCommand: z.enum(["npm ci", "pnpm install --frozen-lockfile", "yarn install --immutable"]).default("npm ci"),
    buildCommand: packageScriptCommand,
    startCommand: packageScriptCommand,
    healthPath: z.string().startsWith("/").max(200),
    // Runs only in the platform's isolated build sandbox, never in AppAI.
    migrationCommand: packageScriptCommand.optional(),
  }).strict(),
  entryPath: z.string().startsWith("/").max(200),
  callbackPath: z.string().startsWith("/").max(200),
  capabilities: z.array(z.enum(UNIVERSAL_APP_CAPABILITIES)).min(1),
}).strict().superRefine((manifest, context) => {
  if (new Set(manifest.capabilities).size !== manifest.capabilities.length) {
    context.addIssue({ code: "custom", path: ["capabilities"], message: "Capabilities must be unique." });
  }
});

const releaseMetadataSchema = z.object({
  manifest: universalAppManifestSchema,
  tagline: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,39}$/).default("OTHER"),
});

const sourceRevisionSchema = z.string().trim().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i);
export const packageDigestSchema = z.string().trim().regex(/^sha256:[0-9a-f]{64}$/i);

export const publishUniversalAppReleaseSchema = z.union([
  releaseMetadataSchema.extend({
    repoUrl: credentialFreeHttpsUrl,
    sourceRevision: sourceRevisionSchema,
  }).strict(),
  releaseMetadataSchema.extend({
    source: z.object({
      type: z.literal("package"),
      uploadId: z.string().cuid(),
      digest: packageDigestSchema,
      sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
    }).strict(),
  }).strict(),
]);

export const createReleasePackageSchema = z.object({
  filename: z.string().trim().min(1).max(240).refine((value) => /\.(?:tgz|tar\.gz)$/i.test(value), "Package must be a .tgz or .tar.gz archive."),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
  contentType: z.enum(["application/gzip", "application/x-gzip", "application/octet-stream"]),
}).strict();

export const approveUniversalAppDeploymentSchema = z.object({
  runtimeBaseUrl: z.url().max(2000),
  artifactDigest: z.string().trim().regex(/^sha256:[0-9a-f]{64}$/i),
  environment: z.enum(["PREVIEW", "PRODUCTION"]).default("PRODUCTION"),
}).strict();

export type UniversalAppManifest = z.infer<typeof universalAppManifestSchema>;
