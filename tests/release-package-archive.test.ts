import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { gzipSync } from "node:zlib";

import { inspectReleasePackageArchive } from "../src/lib/universal-apps/release-package-archive.ts";
import { hydratePackageSource } from "../src/lib/universal-apps/vercel-sandbox-provider.ts";

type TarEntry = { path: string; content?: string; type?: string; size?: number };

function octal(value: number, length: number) {
  return `${value.toString(8).padStart(length - 1, "0")}\0`;
}

function archive(entries: TarEntry[]) {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const content = Buffer.from(entry.content ?? "");
    const size = entry.size ?? content.length;
    const header = Buffer.alloc(512);
    header.write(entry.path);
    header.write(octal(0o644, 8), 100);
    header.write(octal(0, 8), 108);
    header.write(octal(0, 8), 116);
    header.write(octal(size, 12), 124);
    header.write(octal(0, 12), 136);
    header.fill(0x20, 148, 156);
    header.write(entry.type ?? "0", 156);
    header.write("ustar\0", 257);
    header.write("00", 263);
    let checksum = 0;
    for (const byte of header) checksum += byte;
    header.write(octal(checksum, 8), 148);
    parts.push(header, content, Buffer.alloc(Math.ceil(content.length / 512) * 512 - content.length));
  }
  parts.push(Buffer.alloc(1024));
  return new Uint8Array(gzipSync(Buffer.concat(parts)));
}

const manifest = JSON.stringify({
  schemaVersion: 1, id: "inventory-db", name: "Inventory", version: "1.0.0",
  runtime: { type: "node", installCommand: "npm ci", buildCommand: "npm run build", startCommand: "npm run start", healthPath: "/health" },
  entryPath: "/", callbackPath: "/callback", capabilities: ["identity"],
});
const validEntries: TarEntry[] = [
  { path: "appai.app.json", content: manifest },
  { path: "package.json", content: "{}" },
  { path: "package-lock.json", content: "{}" },
  { path: ".env.example", content: "EXAMPLE=true" },
];

test("release archive accepts a normal root package and documented env example", () => {
  const inspected = inspectReleasePackageArchive(archive(validEntries));
  assert.deepEqual(inspected.files.sort(), [".env.example", "appai.app.json", "package-lock.json", "package.json"]);
});

test("release archive rejects traversal, links, private env files, missing required files, and lockfile ambiguity", () => {
  assert.throws(() => inspectReleasePackageArchive(archive([...validEntries, { path: "../escape", content: "bad" }])), /INVALID_PATH/);
  assert.throws(() => inspectReleasePackageArchive(archive([...validEntries, { path: "linked", type: "2" }])), /UNSAFE_ENTRY/);
  assert.throws(() => inspectReleasePackageArchive(archive([...validEntries, { path: ".env.production", content: "secret" }])), /FORBIDDEN_FILE/);
  assert.throws(() => inspectReleasePackageArchive(archive([...validEntries, { path: ".vercel/project.json", content: "token" }])), /FORBIDDEN_FILE/);
  assert.throws(() => inspectReleasePackageArchive(archive([...validEntries, { path: ".npmrc", content: "//registry.npmjs.org/:_authToken=token" }])), /FORBIDDEN_FILE/);
  for (const configPath of ["packages/child/.npmrc", "packages/child/.yarnrc", "packages/child/.yarnrc.yml"]) {
    assert.throws(() => inspectReleasePackageArchive(archive([...validEntries, { path: configPath, content: "registry=https://registry.example.test" }])), /FORBIDDEN_FILE/, configPath);
  }
  assert.throws(() => inspectReleasePackageArchive(archive(validEntries.filter((entry) => entry.path !== "appai.app.json"))), /REQUIRED_FILE_MISSING/);
  assert.throws(() => inspectReleasePackageArchive(archive([...validEntries, { path: "pnpm-lock.yaml", content: "lockfileVersion: '9.0'" }])), /LOCKFILE_REQUIRED/);
});

test("release archive supports ordinary npm, pnpm, and Yarn projects without registry configuration", () => {
  for (const lockfile of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) {
    const entries = validEntries
      .filter((entry) => entry.path !== "package-lock.json")
      .concat({ path: lockfile, content: "lockfile" });
    assert.equal(inspectReleasePackageArchive(archive(entries)).files.includes(lockfile), true, lockfile);
  }
});

test("release archive enforces uncompressed and entry-count limits before extraction", () => {
  assert.throws(() => inspectReleasePackageArchive(archive([...validEntries, { path: "large.txt", size: (100 * 1024 * 1024) + 1 }])), /UNCOMPRESSED_TOO_LARGE/);
  const files = [...validEntries, ...Array.from({ length: 10_000 }, (_, index) => ({ path: `src/f${index}.ts`, content: "" }))];
  assert.throws(() => inspectReleasePackageArchive(archive(files)), /TOO_MANY_FILES/);
});

test("package digest is stable for the immutable archive bytes", () => {
  const bytes = archive(validEntries);
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  assert.match(digest, /^sha256:[0-9a-f]{64}$/);
});

test("every sandbox phase receives the same verified package bytes without a storage URL", async () => {
  const bytes = archive(validEntries);
  const source = { type: "package" as const, bytes, digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}` };
  const writes: Uint8Array[] = [];
  const commands: string[] = [];
  for (const phase of ["validation", "migration", "provider"]) {
    await hydratePackageSource({
      async writeFiles(files) { writes.push(files[0]!.content); },
      async run(command) { commands.push(`${phase}:${command.cmd}:${command.args.join(" ")}`); return { exitCode: 0, stdout: "", stderr: "" }; },
    }, source);
  }
  assert.equal(writes.length, 3);
  assert.equal(writes.every((written) => Buffer.compare(Buffer.from(written), Buffer.from(bytes)) === 0), true);
  assert.equal(commands.every((command) => command.includes("/tmp/appai-release.tgz") && !command.includes("blob") && !command.includes("token")), true);
});
