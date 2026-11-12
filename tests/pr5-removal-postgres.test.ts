import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { isolatedPostgres, sqlStatements, deferred, waitForAdvisoryWait } from "./helpers/pr5-postgres.mjs";
import { verifyRemovalSchema } from "../scripts/check-hosted-page-removal-schema.mjs";
import { managePages, lockPageTrees, type PageStore } from "../src/lib/page-management.ts";
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

test("P8 two independent connections: S1–S4, twenty deterministic interleavings each",{skip:url?false:"Set local TEST_DATABASE_URL for the 80 real-connection races.",timeout:120000},async()=>{
  const local=await isolatedPostgres(url!);const [first,second,observer]=local.clients;
  try{
    await apply(first);
    const [{pid:secondPid}]=await second.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;
    for(let scenario=1;scenario<=4;scenario++) for(let iteration=0;iteration<20;iteration++){
      await first.$executeRaw`TRUNCATE "HostedPage", "HostedPageEvent"`;
      await first.$executeRaw`INSERT INTO "HostedPage" (id,slug,"organizationId","isPublished","isDefault") VALUES ('root','root','org-a',true,true)`;
      const ready=deferred();const release=deferred();
      const hold=(client:PrismaClient)=>({$transaction:async(fn:(tx:PageStore)=>Promise<unknown>)=>client.$transaction(async tx=>{const result=await fn(tx);ready.resolve!();await release.promise;return result;},{timeout:15000})}) as PrismaClient;
      const agent=async(tx:PageStore,create:boolean)=>{
        await lockPageTrees(tx,["org-a:root"]);
        const removed=await tx.hostedPage.findFirst({where:{slug:"root",organizationId:"org-a",removalState:{not:null}}});
        if(removed)return false;
        if(create)await tx.$executeRaw`INSERT INTO "HostedPage" (id,slug,locale,"organizationId","isPublished") VALUES ('ja','root','ja','org-a',true)`;
        else await tx.hostedPage.updateMany({where:{id:"root",removalState:null},data:{isPublished:true}});
        return true;
      };
      const ownerFirst=scenario===1||scenario===4; const create=scenario>=3;
      const held=ownerFirst
        ? managePages(hold(first),owner,{action:create?"delete":"unpublish",targets:["root"],expected:{pages:1,rows:1}})
        : hold(first).$transaction(tx=>agent(tx,create));
      await ready.promise;
      const waiting=ownerFirst ? second.$transaction(tx=>agent(tx,create))
        : managePages(second,owner,{action:create?"delete":"unpublish",targets:["root"],expected:{pages:1,rows:create?2:1}});
      try{await waitForAdvisoryWait(observer,secondPid);}finally{release.resolve!();}
      await Promise.all([held,waiting]);
      const rows=await first.hostedPage.findMany();
      assert.ok(rows.every(row=>row.removalState!==null&&!row.isPublished),`S${scenario} run ${iteration}`);
      if(scenario===4)assert.equal(rows.length,1);
    }
  }finally{await local.close();}
});
