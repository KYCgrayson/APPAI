import { z } from "zod";

export const UNIVERSAL_APP_CAPABILITIES = [
  "identity",
  "database",
  "private-assets",
] as const;

export const universalAppIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/);

export const universalAppManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: universalAppIdSchema,
  name: z.string().trim().min(1).max(120),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  runtime: z.object({
    type: z.enum(["node"]),
    buildCommand: z.string().trim().min(1).max(200),
    startCommand: z.string().trim().min(1).max(200),
    healthPath: z.string().startsWith("/").max(200),
  }).strict(),
  entryPath: z.string().startsWith("/").max(200),
  callbackPath: z.string().startsWith("/").max(200),
  capabilities: z.array(z.enum(UNIVERSAL_APP_CAPABILITIES)).min(1),
}).strict().superRefine((manifest, context) => {
  if (new Set(manifest.capabilities).size !== manifest.capabilities.length) {
    context.addIssue({ code: "custom", path: ["capabilities"], message: "Capabilities must be unique." });
  }
});

export const publishUniversalAppReleaseSchema = z.object({
  manifest: universalAppManifestSchema,
  tagline: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,39}$/).default("OTHER"),
  repoUrl: z.url().startsWith("https://").max(500).optional(),
  sourceRevision: z.string().trim().regex(/^[0-9a-f]{7,64}$/i).optional(),
}).strict();

export const approveUniversalAppDeploymentSchema = z.object({
  runtimeBaseUrl: z.url().max(2000),
  artifactDigest: z.string().trim().regex(/^sha256:[0-9a-f]{64}$/i),
  environment: z.enum(["PREVIEW", "PRODUCTION"]).default("PRODUCTION"),
}).strict();

export type UniversalAppManifest = z.infer<typeof universalAppManifestSchema>;
