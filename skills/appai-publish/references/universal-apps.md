# Universal Apps: immutable package publishing

Use this route for an application with its own UI/API, business rules,
persistent Organization data, or private assets. It is not a Hosted Page.

AppAI is the host platform: it owns review, build, runtime, database,
authentication, domain, deployment, health checks, and activation. The app
owns only its source, manifest, tests, schema, and migrations.

## Package first

The primary release source is a `.tar.gz` or `.tgz` archive of one exact source
revision. A repository URL is optional and is not used as a secret transport.
Build the archive from a clean, committed app workspace:

```bash
git archive --format=tar.gz --output=appai-release.tar.gz HEAD
shasum -a 256 appai-release.tar.gz
```

Do not package `node_modules`, `.next`, `dist`, `build`, `.git`, environment
files (except a values-free `.env.example`), credentials, database dumps, or
any other secrets. Include at the archive root:

- `appai.app.json`
- `package.json` and exactly the lockfile used by the manifest install command
- app source, tests, typecheck configuration, and migrations (if declared)

The manifest in the final request must exactly match the `appai.app.json` in
the archive. Its id must equal `{appId}` in every endpoint path.

## Authenticate

Start the AppAI device flow, present `verification_uri_complete` to the user,
and poll the token endpoint until it returns an API key. Never ask a user to
paste an API key into an application form.

```text
POST https://appai.info/api/v1/auth/device
POST https://appai.info/api/v1/auth/token
```

## Upload and finalize

1. Request a single-use private upload intent:

```text
POST https://appai.info/api/v1/apps/{appId}/release-packages
Authorization: Bearer appai_sk_...
Content-Type: application/json

{ "filename": "appai-release.tar.gz", "sizeBytes": 12345, "contentType": "application/gzip" }
```

2. Upload the package with `@vercel/blob/client` `put(pathname, file, {
   access: "private", token: clientToken })`. `pathname`, `clientToken`, and
   the blob response are transport values; do not log or publish them.

3. Compute lowercase SHA-256 of the exact bytes and finalize the release:

```json
{
  "manifest": { "schemaVersion": 1, "id": "inventory", "name": "Inventory", "version": "1.0.0" },
  "tagline": "Track stock across your organization",
  "description": "A database-backed inventory workflow for teams.",
  "category": "INVENTORY",
  "source": { "type": "package", "uploadId": "…", "digest": "sha256:<64 lowercase hex chars>", "sizeBytes": 12345 }
}
```

The response is a `PENDING` receipt. Poll
`GET /api/v1/apps/{appId}/releases/{releaseId}`; only `APPROVED` plus an
`ACTIVE` production deployment is live. Users enter through `/app/{appId}`.

Never send `organizationId`, runtime/deployment URLs, DB URLs/credentials,
raw SQL, provider tokens, OIDC/CLI credentials, or arbitrary secrets. The
platform never treats Simpleshop specially; it is merely one app using this
generic contract.

## Node helper outline

Install `@vercel/blob` version 2.3.1 or later in the publishing client. Keep
the API key in the agent process only; do not put it in browser UI or logs.

```ts
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob/client";

const baseUrl = "https://appai.info";
const appId = "inventory";
const apiKey = process.env.APPAI_API_KEY!;
const archive = await readFile("appai-release.tar.gz");
const intent = await fetch(`${baseUrl}/api/v1/apps/${appId}/release-packages`, {
  method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
  body: JSON.stringify({ filename: "appai-release.tar.gz", sizeBytes: archive.byteLength, contentType: "application/gzip" }),
}).then((response) => response.json());
await put(intent.pathname, archive, { access: "private", token: intent.clientToken, contentType: "application/gzip" });
const digest = `sha256:${createHash("sha256").update(archive).digest("hex")}`;
const receipt = await fetch(`${baseUrl}/api/v1/apps/${appId}/releases`, {
  method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
  body: JSON.stringify({ manifest, tagline, description, category, source: { type: "package", uploadId: intent.uploadId, digest, sizeBytes: archive.byteLength } }),
}).then((response) => response.json());
```

Never print `intent.pathname`, `intent.clientToken`, or the full API key.
