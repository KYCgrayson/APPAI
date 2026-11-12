import { registerRemovalFixtures } from "./helpers/pr5-removal-loader.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { PrismaClient, HostedPage } from "@prisma/client";
import { NextRequest } from "next/server.js";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { managementStore } from "./helpers/pr5-management-store.mjs";
import { managedPage, removedPage, restoreTree, localeEdge, owner, admin } from "./fixtures/pr5-removal.ts";
import { managePages, transition, type PageAction, type PageActor } from "../src/lib/page-management.ts";
import { toPageDto } from "../src/lib/page-dto.ts";
import { isPublicChild, publicPageWhere } from "../src/lib/hosted-page-visibility.ts";
import { matchesWhere } from "./helpers/hosted-render-loader.mjs";
import { pagePresentation, type PageSummary } from "../src/lib/dashboard-pages.ts";
const state = { store: managementStore(), session: null as null | { user: { id: string } }, cache: [] as boolean[] };
Object.assign(globalThis, { [Symbol.for("appai.test.removal")]: state });
const hooks = [registerHostedRenderLoader(), registerRemovalFixtures(state)];
test.after(() => hooks.reverse().forEach(h => h.deregister()));
const actionRoute = await import("../src/app/api/dashboard/pages/actions/route.ts");
const pagesRoute = await import("../src/app/api/v1/pages/route.ts");
const pageRoute = await import("../src/app/api/v1/pages/[slug]/route.ts");
const publishRoute = await import("../src/app/api/v1/pages/[slug]/publish/route.ts");
const unpublishRoute = await import("../src/app/api/v1/pages/[slug]/unpublish/route.ts");
const defaultRoute = await import("../src/app/api/v1/pages/[slug]/set-default/route.ts");
const sectionRoute = await import("../src/app/api/v1/pages/[slug]/sections/[order]/route.ts");
const childrenRoute = await import("../src/app/api/v1/pages/[slug]/children/route.ts");
const previewRoute = await import("../src/app/api/v1/pages/preview/route.ts");
const appRoute = await import("../src/app/api/v1/apps/[id]/route.ts");
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const reset = (rows = [managedPage("root")]) => { state.store = managementStore(rows); state.cache = []; state.session = { user: { id: "owner" } }; return state.store; };
const client = () => state.store as unknown as PrismaClient;
const req = (path: string, body?: unknown, method = "POST", auth = true, origin = "https://appai.info") => new NextRequest(`https://appai.info${path}`, { method, headers: { ...(auth ? { authorization: "Bearer fixture" } : {}), origin, "content-type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const ctx = (slug = "root") => ({ params: Promise.resolve({ slug, order: "0" }) });
async function action(action: PageAction, targets: string[], actor: PageActor = owner) {
  const scope = await managePages(client(), actor, { action, targets, dryRun: true });
  return managePages(client(), actor, { action, targets, expected: { pages: scope.pages, rows: scope.rows } });
}

test("P5 session authorization, organization isolation and same-origin checks for every action", async () => {
  for (const action of ["unpublish", "delete", "restore"] as const) {
    for (const [user, auth, origin, expected] of [[null, false, "https://appai.info", 401], ["owner", false, "https://appai.info", 200], ["other", false, "https://appai.info", 404], ["no-org", false, "https://appai.info", 403], ["admin", false, "https://appai.info", 200], ["owner", true, "https://appai.info", 401], ["owner", false, "https://foreign.invalid", 403]] as const) {
      const store = reset([action === "restore" ? removedPage("root") : managedPage("root")]);
      state.session = user ? { user: { id: user } } : null;
      const before = hash(store.rows);
      const result = await actionRoute.POST(req("/api/dashboard/pages/actions", { action, targets: ["root-en"], dryRun: true }, "POST", auth, origin));
      assert.equal(result.status, expected, `${action} ${user} ${origin}`);
      assert.equal(hash(store.rows), before);
    }
    const store = reset([managedPage("root"), managedPage("foreign", { organizationId: "org-b" })]);
    const before = hash(store.rows);
    const response = await actionRoute.POST(req("/api/dashboard/pages/actions", { action, targets: ["root-en", "foreign-en"], expected: { pages: 2, rows: 2 } }, "POST", false));
    assert.equal(response.status, 404); assert.equal(hash(store.rows), before); assert.equal(store.events.length, 0);
  }
});

test("P6 every owner/admin transition, idempotence, publication snapshot and atomic rejection", async () => {
  const fixtures = [managedPage("root"), removedPage("root"), removedPage("root", "DELETED"), removedPage("root", "UNPUBLISHED", "ADMIN"), removedPage("root", "DELETED", "ADMIN")];
  const expected = { user: [["UNPUBLISHED", "DELETED", 409], ["UNPUBLISHED", "DELETED", null], [409, "DELETED", null], [403,403,403], [403,403,403]], admin: [["UNPUBLISHED", "DELETED", 409], ["UNPUBLISHED", "DELETED", null], [409,"DELETED",null], ["UNPUBLISHED","DELETED",null], [409,"DELETED",null]] };
  for (const actor of [owner, admin]) for (const [index, row] of fixtures.entries()) for (const [j, verb] of (["unpublish","delete","restore"] as const).entries()) {
    const store = reset([row]); const before = structuredClone(store.rows[0]);
    const want = expected[actor.kind][index][j];
    if (typeof want === "number") {
      await assert.rejects(action(verb, [row.id], actor), { status: want });
      assert.deepEqual(store.rows[0], before); assert.equal(store.events.length, 0);
    } else {
      await action(verb, [row.id], actor);
      const saved = store.rows[0]; assert.equal(saved.removalState, want);
      assert.equal(saved.isPublished, want ? false : before.wasPublished);
      const changed = transition(before as HostedPage, verb, actor).changed;
      assert.equal(store.events.length, changed ? 1 : 0);
      if (!changed) assert.deepEqual(saved, before);
      else if (want) assert.equal(saved.wasPublished, before.removalState ? before.wasPublished : before.isPublished);
    }
  }
  const store = reset([managedPage("root"), removedPage("locked", "DELETED", "ADMIN")]);
  const before = hash(store.rows);
  await assert.rejects(action("delete", ["root-en", "locked-en"]), { status: 403, code: "admin_locked" });
  assert.equal(hash(store.rows), before);
});

test("P7 OU/OD/AD block nine public writes, new locale/child, App PUT and previews, with per-attempt API-key audit", async () => {
  for (const [removal, source] of [["UNPUBLISHED","OWNER"],["DELETED","OWNER"],["DELETED","ADMIN"]]) {
    const store = reset([removedPage("root", removal, source)]);
    store.apps.push({ id: "bound", hostedPageSlug: "root", organizationId: "org-a" });
    const payload = { slug: "root", title: "Root", content: { sections: [] }, isPublished: true };
    const calls = [
      () => pagesRoute.POST(req("/api/v1/pages", payload)),
      () => pagesRoute.POST(req("/api/v1/pages?upsert=true", payload)),
      () => pageRoute.PUT(req("/api/v1/pages/root", { title: "Replaced" }, "PUT"), ctx()),
      () => pageRoute.PATCH(req("/api/v1/pages/root", { title: "Edited" }, "PATCH"), ctx()),
      () => pageRoute.DELETE(req("/api/v1/pages/root", undefined, "DELETE"), ctx()),
      () => publishRoute.POST(req("/api/v1/pages/root/publish"), ctx()),
      () => defaultRoute.POST(req("/api/v1/pages/root/set-default?locale=en"), ctx()),
      () => sectionRoute.PATCH(req("/api/v1/pages/root/sections/0", { data: {} }, "PATCH"), ctx()),
      () => pagesRoute.POST(req("/api/v1/pages", { ...payload, locale: "ja" })),
      () => appRoute.PUT(req("/api/v1/apps/bound", { hostedPageSlug: null }, "PUT"), { params: Promise.resolve({ id: "bound" }) }),
    ];
    const before = hash(store.rows);
    for (const call of calls) { const result = await call(); assert.equal(result.status, 409); const json = await result.json(); assert.equal(json.code, "removed_by_owner"); assert.equal(json.retryable, false); assert.equal(json.requiredAction, "owner_restore_in_dashboard"); assert.equal(json.removal.restoreUntil, null); }
    const child = await pagesRoute.POST(req("/api/v1/pages", { ...payload, slug: "child", parentSlug: "root" }));
    assert.equal(child.status, 409); assert.equal((await child.json()).code, "parent_removed_by_owner");
    const unpublish = await unpublishRoute.POST(req("/api/v1/pages/root/unpublish"), ctx());
    assert.equal(unpublish.status, 200); assert.ok((await unpublish.json()).removedByOwner);
    for (const preview of [() => previewRoute.POST(req("/api/v1/pages/preview", payload)), () => pagesRoute.POST(req("/api/v1/pages?dryRun=true", payload))]) {
      const result = await preview(); assert.equal(result.status, 200); const json = await result.json(); assert.equal(json.valid, false); assert.equal(json.errors.at(-1).code, "removed_by_owner"); assert.ok(Array.isArray(json.warnings));
    }
    assert.equal(hash(store.rows), before); assert.equal(store.events.length, calls.length + 4);
    assert.ok(store.events.every(e => e.action === "agent_blocked" && e.apiKeyId === "key-fixture" && e.actorKind === "apiKey"));
    assert.equal(state.cache.length, 0);
  }
});

test("P9 all locales and fallback sources removed; future locale blocked; P1 allowlist DTOs retain existing keys + removal", async () => {
  const rows = ["en","zh-TW","zh-CN"].flatMap((locale, i) => [managedPage("root", { id: `root-${locale}`, locale, isDefault: i === 0 }), managedPage("child", { id: `child-${locale}`, parentSlug: "root", locale, isDefault: i === 0 })]);
  reset(rows); await action("delete", ["root-en"]);
  const { resolvePage, resolveChildPage } = await import("../src/lib/hosted-page-resolver.ts");
  for (const locale of [null,"zh-TW","zh-HK","ja"]) { assert.equal(await resolvePage("root", locale), null); assert.equal(await resolveChildPage("root","child",locale,"org-a"), null); }
  const result = await pagesRoute.POST(req("/api/v1/pages", { slug:"root", locale:"ja", title:"New", content:{sections:[]} }));
  assert.equal(result.status,409);
  reset([managedPage("root"), removedPage("child", "DELETED", "OWNER", { parentSlug:"root" })]);
  for (const result of [await pagesRoute.GET(req("/api/v1/pages",undefined,"GET")), await pageRoute.GET(req("/api/v1/pages/root?variants=true",undefined,"GET"),ctx()), await childrenRoute.GET(req("/api/v1/pages/root/children",undefined,"GET"),ctx())]) {
    const json = await result.json(); const dtos = Array.isArray(json) ? json : json.children;
    assert.ok(dtos.length); for (const dto of dtos) { assert.ok("removedByOwner" in dto); assert.ok(!("removedById" in dto || "removalBatchId" in dto || "wasPublished" in dto || "removalState" in dto)); }
  }
  const row = managedPage("plain"); const dto = toPageDto({ ...row, futureSecret: "internal" } as unknown as HostedPage);
  assert.equal(dto.removedByOwner,null); assert.ok(!("futureSecret" in dto));
  const oldFields = Object.keys(row).filter(k => !["removalState","removalSource","removedAt","removedById","removalBatchId","wasPublished"].includes(k));
  assert.deepEqual(Object.keys(dto).sort(), [...oldFields,"removedByOwner"].sort());
});

test("P10 batch-aware delete/restore preserves draft, earlier OU and admin locks; P13 snapshots", async () => {
  const store = reset(restoreTree());
  const deleted = await action("delete", ["tree-en"]);
  assert.equal(deleted.children, 3); assert.equal(deleted.skipped.length,2);
  assert.ok(store.rows.filter(p => ["tree","c1","c4","c5"].includes(p.slug)).every(p => p.removalState === "DELETED" && p.removalBatchId === deleted.batchId));
  await assert.rejects(action("restore", ["c4-en"]), { status:409, code:"parent_removed" });
  await action("restore", ["tree-en"]);
  assert.deepEqual(store.rows.map(p => [p.slug,p.isPublished,p.removalState]), [["tree",true,null],["c1",false,null],["c2",false,"UNPUBLISHED"],["c3",false,"DELETED"],["c4",true,null],["c5",true,null]]);
  await assert.rejects(action("restore", ["c3-en"]), {status:403,code:"admin_locked"});
  assert.equal(store.events.length,8);
  assert.ok(store.events.every(e => e.actorUserId === "owner" && e.actorKind === "user" && e.organizationId === "org-a" && e.pageId && e.batchId));
  assert.ok(store.events.slice(0,4).every(e => e.action === "delete" && e.fromState === null && e.toState === "DELETED"));
  assert.ok(store.events.slice(4).every(e => e.action === "restore" && e.fromState === "DELETED" && e.toState === null));
  // Root unpublish hides children without modifying them.
  reset(restoreTree()); const beforeChild = hash(state.store.rows.slice(1)); await action("unpublish",["tree-en"]); assert.equal(hash(state.store.rows.slice(1)),beforeChild);
});

test("P11 target/expanded caps and stale confirmation are atomic; P12 cache follows commit", async () => {
  reset();
  assert.equal((await actionRoute.POST(req("/api/dashboard/pages/actions",{ action:"delete",targets:Array.from({length:101},()=>"root-en"),dryRun:true },"POST",false))).status,400);
  reset([managedPage("root"), ...Array.from({length:1000},(_,i)=>managedPage(`c${i}`,{parentSlug:"root"}))]);
  await assert.rejects(action("delete",["root-en"]),{status:413,code:"batch_too_large"}); assert.equal(state.store.events.length,0);
  const store = reset(); const scope = await managePages(client(),owner,{action:"delete",targets:["root-en"],dryRun:true});
  store.rows.push(managedPage("child",{parentSlug:"root"})); const before = hash(store.rows);
  const stale = await actionRoute.POST(req("/api/dashboard/pages/actions",{action:"delete",targets:["root-en"],expected:{pages:scope.pages,rows:scope.rows}},"POST",false));
  assert.equal(stale.status,409); assert.equal((await stale.json()).code,"scope_changed"); assert.equal(hash(store.rows),before); assert.equal(state.cache.length,0);
  const success = await actionRoute.POST(req("/api/dashboard/pages/actions",{action:"delete",targets:["root-en"],expected:{pages:2,rows:2}},"POST",false));
  assert.equal(success.status,200); assert.deepEqual(state.cache,[true]);
});

test("P14 fully deleted roots free a slot; restore rechecks plan; mixed removed locales still count", async () => {
  const store = reset([managedPage("one"),managedPage("two"),managedPage("three")]); store.organizations[0].plan="FREE";
  await action("delete",["one-en"]);
  const response = await pagesRoute.POST(req("/api/v1/pages",{slug:"four",title:"Fourth",content:{sections:[]}}));
  assert.equal(response.status,201);
  await assert.rejects(action("restore",["one-en"]),{status:403,code:"plan_limit"});
  assert.equal(store.rows.find(p=>p.slug==="one")?.removalState,"DELETED");
});

test("PR-5a edge: root en published/ja draft; child en/ja published agrees across predicate, query and label", () => {
  const roots = localeEdge.filter(p => !p.parentSlug);
  for (const row of localeEdge.filter(p=>p.parentSlug)) {
    const visible = row.locale === "en";
    assert.equal(isPublicChild(row,roots),visible); assert.equal(matchesWhere(row,publicPageWhere(roots)),visible);
    const presentation = pagePresentation({...row,hasPrivacy:false,hasTerms:false} as unknown as PageSummary, roots as unknown as PageSummary[]);
    assert.equal(presentation.status,visible ? "Published" : "Hidden — root not public"); assert.equal(!!presentation.view,visible);
  }
});


test("P1 live pages replay all nine original writes; nested set-default DTO and org-scoped App sync",async()=>{
  const store=reset();
  store.apps.push({id:"foreign",hostedPageSlug:"root",organizationId:"org-b",name:"Foreign"});
  const payload={slug:"created",title:"Created",content:{sections:[]}};
  const created=await pagesRoute.POST(req("/api/v1/pages",payload));assert.equal(created.status,201);assert.equal((await created.json()).removedByOwner,null);
  const upsert=await pagesRoute.POST(req("/api/v1/pages?upsert=true",{...payload,title:"Upserted"}));assert.equal(upsert.status,200);assert.equal((await upsert.json()).removedByOwner,null);
  for(const [handler,method,title] of [[pageRoute.PUT,"PUT","Replaced"],[pageRoute.PATCH,"PATCH","Patched"]] as const){const response=await handler(req("/api/v1/pages/root",{title},method),ctx());assert.equal(response.status,200);const dto=await response.json();assert.equal(dto.title,title);assert.equal(dto.removedByOwner,null);}
  const section=await sectionRoute.PATCH(req("/api/v1/pages/root/sections/0",{data:{text:"Edited"}},"PATCH"),ctx());assert.equal(section.status,200);
  assert.equal((await unpublishRoute.POST(req("/api/v1/pages/root/unpublish"),ctx())).status,200);assert.equal(store.rows.find(p=>p.slug==="root")?.isPublished,false);
  assert.equal((await publishRoute.POST(req("/api/v1/pages/root/publish"),ctx())).status,200);assert.equal(store.rows.find(p=>p.slug==="root")?.isPublished,true);
  const newDefault=await defaultRoute.POST(req("/api/v1/pages/root/set-default?locale=en"),ctx());assert.equal(newDefault.status,200);const nested=(await newDefault.json()).page;assert.equal(nested.removedByOwner,null);assert.ok(!("removedById" in nested));
  assert.equal(store.apps.find(p=>p.id==="foreign")?.name,"Foreign");
  assert.equal((await pageRoute.DELETE(req("/api/v1/pages/created",undefined,"DELETE"),ctx("created"))).status,200);assert.ok(!store.rows.some(p=>p.slug==="created"));assert.equal(store.events.length,0);
});


test("logical removal isolates identical slugs under different parents; a hidden live child remains editable",async()=>{
  const store=reset([removedPage("root"),managedPage("child",{parentSlug:"root"})]);
  const response=await pagesRoute.POST(req("/api/v1/pages?upsert=true",{slug:"child",parentSlug:"root",title:"Still hidden",content:{sections:[]}}));
  assert.equal(response.status,200);assert.equal(store.rows.find(p=>p.slug==="root")?.removalState,"UNPUBLISHED");
  const future=await pagesRoute.POST(req("/api/v1/pages",{slug:"child",parentSlug:"root",locale:"ja",title:"New locale",content:{sections:[]}}));assert.equal(future.status,409);assert.equal((await future.json()).code,"parent_removed_by_owner");
  reset([removedPage("shared"),managedPage("parent"),managedPage("shared",{id:"shared-ja",locale:"ja",parentSlug:"parent"})]);
  const independent=await pageRoute.PATCH(req("/api/v1/pages/shared?locale=ja",{title:"Independent logical page"},"PATCH"),ctx("shared"));assert.equal(independent.status,200);
});


test("P5 admin endpoint shares confirmed transitions; legacy hard deletion never discards removed rows",async()=>{
  const route=await import("../src/app/api/admin/pages/route.ts");
  const store=reset();state.session={user:{id:"admin"}};
  const response=await route.POST(req("/api/admin/pages",{action:"unpublish",targets:["root-en"],expected:{pages:1,rows:1}},"POST",false));
  assert.equal(response.status,200);assert.equal(store.rows[0].removalSource,"ADMIN");assert.equal(store.events[0].actorKind,"admin");
  const before=hash(store.rows);assert.equal((await route.DELETE()).status,409);assert.equal(hash(store.rows),before);
});
