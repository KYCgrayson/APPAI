import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { isolatedPostgres, sqlStatements, deferred, waitForAdvisoryWait, postgresTimeoutMs } from "./helpers/pr5-postgres.mjs";
import { verifyRemovalSchema } from "../scripts/check-hosted-page-removal-schema.mjs";
import { managePages, type PageStore } from "../src/lib/page-management.ts";
import { NextRequest } from "next/server.js";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { registerRemovalFixtures } from "./helpers/pr5-removal-loader.mjs";
import { owner } from "./fixtures/pr5-removal.ts";
const url = process.env.TEST_DATABASE_URL;
const migration = readFileSync(new URL("../prisma/hosted-page-removal-migration.sql",import.meta.url),"utf8");
const apply = async (client: PrismaClient) => {for(const sql of sqlStatements(migration)) await client.$executeRawUnsafe(sql);};

test("P16 M1 twice, verification, CHECK rejection, drift detection, and old-column read compatibility",{skip:url?false:"Set local TEST_DATABASE_URL; PGlite is not installed in this sandbox."},async()=>{
  const local=await isolatedPostgres(url!);const db=local.clients[0];
  try{
    await assert.rejects(verifyRemovalSchema((sql: string)=>db.$queryRawUnsafe(sql)));
    await apply(db);await apply(db);assert.match(await verifyRemovalSchema((sql: string)=>db.$queryRawUnsafe(sql)),/verified/);
    await db.$executeRaw`INSERT INTO "HostedPage" (id,slug,"organizationId","isPublished") VALUES ('legacy','legacy','org-a',true)`;
    const before=await db.$queryRaw`SELECT id,slug,"isPublished" FROM "HostedPage" WHERE id='legacy'`;
    assert.deepEqual(before,[{id:"legacy",slug:"legacy",isPublished:true}]);
    await managePages(db,owner,{action:"delete",targets:["legacy"],expected:{pages:1,rows:1}});
    await assert.rejects(db.$executeRaw`UPDATE "HostedPage" SET "isPublished"=true WHERE id='legacy'`);
    await assert.rejects(db.$executeRaw`UPDATE "HostedPage" SET "wasPublished"=NULL WHERE id='legacy'`);
    await assert.rejects(db.$executeRaw`UPDATE "HostedPage" SET "removalState"='UNKNOWN' WHERE id='legacy'`);
    await db.$executeRaw`ALTER TABLE "HostedPage" ALTER COLUMN "removedAt" TYPE TIMESTAMP(6)`;
    await assert.rejects(verifyRemovalSchema((sql: string)=>db.$queryRawUnsafe(sql)),/precision/);
  }finally{await local.close();}
});

test("P8 real publish/create routes, two independent connections: S1–S4, twenty deterministic interleavings each", {
  skip: url ? false : "Set local TEST_DATABASE_URL for the 80 real-connection races.",
  timeout: Math.max(120000, postgresTimeoutMs * 8),
}, async () => {
  assert.ok(Number.isFinite(postgresTimeoutMs) && postgresTimeoutMs > 0, "TEST_DATABASE_TIMEOUT_MS must be positive");
  const local = await isolatedPostgres(url!);
  const [first, second, observer] = local.clients;
  const state = { store: second, actor: { organizationId: "org-a", apiKeyId: "key-fixture", organization: { plan: "PRO" } }, cache: [] };
  const hooks = [registerHostedRenderLoader(), registerRemovalFixtures(state)];
  try {
    const publish = await import("../src/app/api/v1/pages/[slug]/publish/route.ts");
    const pages = await import("../src/app/api/v1/pages/route.ts");
    await apply(first);
    // The real create route also checks administrator plan exemptions.
    await first.$executeRaw`CREATE TABLE "User" (id TEXT PRIMARY KEY, "organizationId" TEXT, role TEXT)`;
    const [{ pid: secondPid }] = await second.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    const agent = (create: boolean) => {
      const path = create ? "/api/v1/pages" : "/api/v1/pages/root/publish";
      const request = new NextRequest(`https://appai.info${path}`, { method: "POST",
        headers: { authorization: "Bearer fixture", "content-type": "application/json" },
        ...(create ? { body: JSON.stringify({ slug: "root", locale: "ja", title: "Japanese", content: { sections: [] }, isPublished: true }) } : {}),
      });
      return create ? pages.POST(request) : publish.POST(request, { params: Promise.resolve({ slug: "root" }) });
    };
    const transactionClient = (client: PrismaClient, beforeCommit = async () => {}) => new Proxy(client, { get(client, key) {
      if (key === "$transaction") return (fn: (tx: PageStore) => Promise<unknown>) => client.$transaction(async tx => {
        const result = await fn(tx);
        await beforeCommit();
        return result;
      }, { maxWait: postgresTimeoutMs, timeout: postgresTimeoutMs });
      const value = Reflect.get(client, key);
      return typeof value === "function" ? value.bind(client) : value;
    } });
    const waitingClient = transactionClient(second);
    for (let scenario = 1; scenario <= 4; scenario++) for (let iteration = 0; iteration < 20; iteration++) {
      await first.$executeRaw`TRUNCATE "HostedPage", "HostedPageEvent"`;
      const create = scenario >= 3;
      await first.$executeRaw`INSERT INTO "HostedPage" (id,slug,"organizationId","isPublished","isDefault") VALUES ('root','root','org-a',${create},true)`;
      const ready = deferred();
      const release = deferred();
      // Hold the real first writer's transaction open after its operation, before commit.
      const heldClient = transactionClient(first, async () => { ready.resolve(); await release.promise; });
      const ownerFirst = scenario === 1 || scenario === 4;
      state.store = ownerFirst ? waitingClient : heldClient;
      const held = ownerFirst
        ? managePages(heldClient, owner, { action: create ? "delete" : "unpublish", targets: ["root"], expected: { pages: 1, rows: 1 } })
        : agent(create);
      await Promise.race([ready.promise, held.then(() => { throw new Error("First writer finished without reaching the commit barrier"); })]);
      const waiting = ownerFirst ? agent(create)
        : managePages(waitingClient, owner, { action: create ? "delete" : "unpublish", targets: ["root"], expected: { pages: 1, rows: create ? 2 : 1 } });
      try { await waitForAdvisoryWait(observer, secondPid); } finally { release.resolve(); }
      const [heldResult, waitingResult] = await Promise.all([held, waiting]);
      const response = (ownerFirst ? waitingResult : heldResult) as Response;
      assert.equal(response.status, ownerFirst ? 409 : create ? 201 : 200, `S${scenario} run ${iteration}`);
      if (ownerFirst) assert.equal((await response.json()).code, "removed_by_owner");
      const rows = await first.hostedPage.findMany();
      assert.ok(rows.every(row => row.removalState !== null && !row.isPublished), `S${scenario} run ${iteration}`);
      assert.equal(rows.length, scenario === 3 ? 2 : 1);
      assert.equal(rows.find(row => row.id === "root")!.wasPublished, create || !ownerFirst);
      const events = await first.hostedPageEvent.findMany({ where: { action: "agent_blocked" } });
      assert.equal(events.length, ownerFirst ? 1 : 0);
      if (ownerFirst) assert.equal(events[0].apiKeyId, "key-fixture");
    }
  } finally {
    hooks.reverse().forEach(hook => hook.deregister());
    await local.close();
  }
});
