import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyRemovalSchema, normalizeCheck } from "../scripts/check-hosted-page-removal-schema.mjs";
const migration = readFileSync(new URL("../prisma/hosted-page-removal-migration.sql", import.meta.url), "utf8");
const definition = "CHECK (" + migration.split('CHECK (')[1].split(') NOT VALID')[0] + ")";
function schema() {
  const columns: { table_name: string; column_name: string; data_type: string; is_nullable: string; datetime_precision: number | null; column_default: string | null }[] = [];
  const events = ["id","createdAt","batchId","organizationId","pageId","slug","parentSlug","locale","action","fromState","toState","actorKind","actorUserId","apiKeyId"];
  for (const table of ["HostedPage","HostedPageEvent"]) for (const column of table === "HostedPage" ? ["removalState","removalSource","removedAt","removedById","removalBatchId","wasPublished"] : events) {
    const date = ["removedAt","createdAt"].includes(column);
    columns.push({table_name:table,column_name:column,data_type:date ? "timestamp without time zone" : column === "wasPublished" ? "boolean" : "text",is_nullable:table === "HostedPage" || ["parentSlug","fromState","toState","actorUserId","apiKeyId"].includes(column) ? "YES" : "NO",datetime_precision:date ? 3 : null,column_default:null});
  }
  const constraints = [{conname:"HostedPage_removal_consistent",contype:"c",convalidated:true,definition,table_name:"HostedPage"},{conname:"HostedPageEvent_pkey",contype:"p",convalidated:true,definition:"PRIMARY KEY (id)",table_name:"HostedPageEvent"}];
  const indexes = [["HostedPage","organizationId"],["HostedPageEvent","organizationId"],["HostedPageEvent","pageId"]].map(([table,field])=>({indexname:`${table}_${field}_createdAt_idx`,indexdef:`CREATE INDEX ON public."${table}" USING btree ("${field}", "createdAt")`}));
  return {columns,constraints,indexes};
}
const verify = (data: ReturnType<typeof schema>) => verifyRemovalSchema(async (sql: string) => sql.includes("information_schema") ? data.columns : sql.includes("pg_constraint") ? data.constraints : data.indexes);
test("P16 schema verifier accepts exact contract and pg deparser IN/ANY format, rejects type/nullability/precision/CHECK/index drift", async () => {
  const good = schema(); assert.match(await verify(good), /verified/);
  const deparsed = definition.replace(/"removalState" IN \('UNPUBLISHED', 'DELETED'\)/, "(\"removalState\" = ANY (ARRAY['UNPUBLISHED'::text, 'DELETED'::text]))");
  assert.equal(normalizeCheck(deparsed),normalizeCheck(definition));
  for (const mutate of [
    (s: ReturnType<typeof schema>)=>{s.columns[0].data_type="integer";},
    (s: ReturnType<typeof schema>)=>{s.columns[1].is_nullable="NO";},
    (s: ReturnType<typeof schema>)=>{s.columns[2].datetime_precision=6;},
    (s: ReturnType<typeof schema>)=>{s.constraints[0].convalidated=false;},
    (s: ReturnType<typeof schema>)=>{s.constraints[0].definition=definition.replace('"isPublished" = false','"isPublished" = true');},
    (s: ReturnType<typeof schema>)=>{s.indexes[0].indexdef+=' WHERE false';},
    (s: ReturnType<typeof schema>)=>{s.constraints.push({conname:"unexpected_fk",contype:"f",convalidated:true,definition:"FOREIGN KEY",table_name:"HostedPageEvent"});},
  ]) {const changed=schema();mutate(changed);await assert.rejects(verify(changed));}
  // Parentheses are semantic; a grouping change must not normalize away.
  assert.notEqual(normalizeCheck("CHECK ((a IS NULL OR b IS NULL) AND c IS NULL)"),normalizeCheck("CHECK (a IS NULL OR (b IS NULL AND c IS NULL))"));
  assert.match(migration,/^BEGIN;/m); assert.match(migration,/^COMMIT;/m); assert.match(migration,/NOT VALID/); assert.match(migration,/VALIDATE CONSTRAINT/);
});
