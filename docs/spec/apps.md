# AppAI — Universal App
Covers Universal App manifests, immutable releases, platform review and runtime contracts.
Previous: [Overview](https://appai.info/spec) · Next: [Authorization & API](https://appai.info/spec/api)
API base: `https://appai.info`; auth: `Authorization: Bearer appai_sk_YOUR_KEY`.

Follow [Authorization & API](https://appai.info/spec/api) for the key, then return here for the release steps.

### Universal apps

Full applications built by agents can run on AppAI without becoming part of
the AppAI monolith. The app workspace owns UI, API, business rules, schema,
migrations, tests, and `appai.app.json`; AppAI owns review, isolated runtime,
login, Organization context, app-scoped database, private assets, quota, and
monitoring.

| Operation | Endpoint | Rule |
|-----------|----------|------|
| Create package upload | `POST /api/v1/apps/{appId}/release-packages` | Bearer API key; returns a single-use private upload intent. The signed-in Publisher Portal may request the <=4 MiB same-origin server transport; the 20 MiB public limit is unchanged. |
| Submit release | `POST /api/v1/apps/{appId}/releases` | Bearer API key; manifest id must match the path; package source is primary |
| Open app | `/app/{appId}` | Browser login; AppAI selects the approved deployment and hands off once to `https://{appId}.appai.info` |
| Runtime identity | `POST /api/runtime/sessions/introspect` | Opaque runtime bearer; returns only granted context |
| Private images/PDFs | `/api/runtime/assets` | Requires the `private-assets` capability |

#### Natural release flow

1. **Authorize the agent** through the [device flow](https://appai.info/spec/api#authentication): Show the user verification_uri_complete: open it in the user's own browser if you can, and always print it. The user signs in with Google if asked, checks that the code matches, and clicks Approve. Never approve it yourself. The agent receives the key — nothing to copy or paste. Reuse a key already stored securely when available.
2. **Add `appai.app.json`** at the application root. It declares the id, version, a lockfile-strict install command (`npm ci`, `pnpm install --frozen-lockfile`, or `yarn install --immutable`), safe build/start commands, health path, entry/callback paths, optional migration command, and requested capabilities. The workspace `package.json` must define `test` and `typecheck` scripts.
3. **Package and submit:** create a source-only archive from the exact commit with `git archive --format=tar.gz --output=appai-release.tar.gz HEAD`. Exclude `node_modules`, build output, `.git`, environment files except a values-free `.env.example`, and secrets. Call `POST /api/v1/apps/{appId}/release-packages`, upload the archive privately with its short-lived client token, calculate `sha256:<digest>`, then submit `POST /api/v1/apps/{appId}/releases` with `source: { type: "package", uploadId, digest, sizeBytes }`. The signed-in Publisher Portal uses a same-origin server upload for packages <=4 MiB and does not expose Blob transport values; larger packages retain the direct upload flow. The public package limit remains 20 MiB. The manifest `id` must equal `{appId}`. A repository URL is optional provenance metadata, never a requirement. This creates a `PENDING` managed release receipt.
4. **Await platform review:** A `PENDING` receipt means the release has been accepted for AppAI review; it does not start infrastructure work by itself. An AppAI administrator approves the release and starts the managed validation and delivery pipeline.
5. **AppAI manages validation and delivery after approval:** AppAI verifies the immutable package and manifest, installs dependencies, and requires the app's `test`, `typecheck`, and declared build command to pass in an isolated sandbox. It provisions an app-scoped database with separate migration/runtime roles when requested, runs the declared migration command in the migration context, deploys the isolated runtime, performs a health check, and records immutable artifact/deployment evidence.
6. **Poll:** `GET /api/v1/apps/{appId}/releases/{releaseId}` while the release awaits review and then until it is `APPROVED` with an `ACTIVE` production deployment and current health evidence. Only then do users launch `/app/{appId}`; AppAI supplies browser login plus an opaque, short-lived runtime session.

#### Copyable database app example

Keep source code in the application's workspace and package it for release.
For example, an inventory application includes this `appai.app.json` at its
package root:

```json
{
  "schemaVersion": 1,
  "id": "inventory",
  "name": "Inventory Manager",
  "version": "1.0.0",
  "runtime": {
    "type": "node",
    "installCommand": "npm ci",
    "buildCommand": "npm run build",
    "startCommand": "npm run start",
    "healthPath": "/api/health",
    "migrationCommand": "npm run migrate"
  },
  "entryPath": "/app/inventory",
  "callbackPath": "/api/appai/callback",
  "capabilities": ["identity", "database"]
}
```

Submit declarative release metadata after privately uploading the immutable
source package. The package source is primary; do not submit infrastructure
credentials or require a public repository:

```bash
curl -X POST https://appai.info/api/v1/apps/inventory/releases \
  -H "Authorization: Bearer appai_sk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": {
      "schemaVersion": 1,
      "id": "inventory",
      "name": "Inventory Manager",
      "version": "1.0.0",
      "runtime": { "type": "node", "installCommand": "npm ci", "buildCommand": "npm run build", "startCommand": "npm run start", "healthPath": "/api/health", "migrationCommand": "npm run migrate" },
      "entryPath": "/app/inventory",
      "callbackPath": "/api/appai/callback",
      "capabilities": ["identity", "database"]
    },
    "tagline": "Track stock across your organization",
    "description": "A database-backed inventory workflow for teams.",
    "category": "INVENTORY",
    "source": {
      "type": "package",
      "uploadId": "UPLOAD_ID_FROM_RELEASE_PACKAGES",
      "digest": "sha256:LOWERCASE_SHA256_OF_ARCHIVE",
      "sizeBytes": 12345
    }
  }'
```

The accepted response is a receipt such as
`{ "appId": "inventory", "releaseId": "...", "version": "1.0.0", "status": "PENDING" }`.
Store `releaseId` and poll `GET /api/v1/apps/inventory/releases/{releaseId}`.
`PENDING` means the release is awaiting AppAI platform review. After an AppAI
administrator starts the managed pipeline, AppAI performs validation, build,
database provisioning, migration, deployment, health verification, and
activation. Agents never choose a runtime URL, database URL, provider
credential, artifact digest, deployment state, or health result. Poll the
release until AppAI has activated the verified production deployment.

#### Database runtime contract

Requesting the `database` capability asks AppAI to provision an app-scoped
PostgreSQL schema and deployment-scoped credentials. AppAI injects the
server-only runtime `DATABASE_URL` only into the approved isolated runtime;
never expose it to browser code or a public environment variable. The app
workspace and release package own schema/migrations, while AppAI runs `migrationCommand` with a separate
migration role and gives the runtime role only its target-schema DML/sequence
permissions. AppAI also injects `APPAI_PLATFORM_URL` and `APPAI_APP_ID`.

User and Organization context comes only from the AppAI launch-code
exchange/introspection runtime session. Never accept `userId` or
`organizationId` in a request body, and never derive either from a public
environment variable.

#### Required app authentication chrome and logout

Every Universal App must treat `/app/{appId}` as the AppAI SSO login gate. After
login, AppAI hands the browser off once to the platform-managed
`https://{appId}.appai.info` subdomain. The isolated runtime receives a
one-time launch code, exchanges it at
`POST /api/runtime/sessions/exchange`, then obtains its trusted context from
`POST /api/runtime/sessions/introspect`. It must not invent its own browser
identity contract. Agents cannot choose a runtime domain.

For every protected app screen, provide a conventional responsive top-right
app header showing the signed-in user's safe display name or email and the
Organization name. If identity display data is unavailable, show a neutral
fallback such as “Signed in with AppAI”; never substitute raw IDs. The same
header must include a **Return to AppAI** link and a **POST** app logout
action.

App logout uses the runtime bearer to call
`POST /api/runtime/sessions/revoke` with a strict matching `appId`, clears the
app's local HttpOnly runtime-session cookie, then routes the browser to
`/logout?callbackUrl=/` on AppAI for platform signout. Never render or expose
the runtime token, `userId`, `organizationId`, credentials, or database URLs
in browser UI or public environment variables.

Release submission accepts declarative metadata plus an immutable package.
External agents never send `organizationId`, deployment/runtime URL, database
credentials, provider/OIDC/CLI credentials, raw SQL, secrets, or artifact
digests. AppAI owns the isolated validation/build/migration/deploy/health/
activation sequence. Simpleshop is the first example of this generic contract;
it has no special publishing API.

All topics: [Overview](https://appai.info/spec) · [Authorization & API](https://appai.info/spec/api) · [Style & logo](https://appai.info/spec/style) · [Theme](https://appai.info/spec/theme) · [Typography](https://appai.info/spec/typography) · [Pages](https://appai.info/spec/pages) · [Sections](https://appai.info/spec/sections) · [Multi-language & multi-page](https://appai.info/spec/i18n) · [Tools](https://appai.info/spec/tools) · [Universal App](https://appai.info/spec/apps)
