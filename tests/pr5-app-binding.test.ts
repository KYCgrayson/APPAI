import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { fixtureDb, registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { registerPr5PublicFixtures, pr5State } from "./helpers/pr5-public-loader.mjs";
import { page, app } from "./fixtures/pr5-pages.ts";
const hooks = [registerHostedRenderLoader(), registerPr5PublicFixtures()];
test.after(() => hooks.reverse().forEach(hook => hook.deregister()));
const collection = await import("../src/app/api/v1/apps/route.ts");
const item = await import("../src/app/api/v1/apps/[id]/route.ts");
const request = (body: unknown, method: string) => new NextRequest("https://appai.info/api/v1/apps", { method, headers: { authorization: "Bearer fixture", "content-type": "application/json" }, body: JSON.stringify(body) });
Object.assign(fixtureDb.app, {
  async count() { return 0; },
  async create({ data }: { data: Record<string, unknown> }) { pr5State.writes++; return { id: "created", ...data }; },
  async update({ data }: { data: Record<string, unknown> }) { pr5State.writes++; return { ...fixtureDb.apps[0], ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) }; },
});

test("App POST/PUT accepts same-org roots (including drafts), clears bindings, rejects children/foreign/missing with field paths", async () => {
  fixtureDb.rows = [page("root"), page("draft-root", { isPublished: false }),
    page("child", { parentSlug: "root" }), page("foreign", { organizationId: "org-b" })];
  fixtureDb.apps = [app("existing", "root")];
  for (const method of ["POST", "PUT"] as const) for (const [binding, expected] of [
    ["root", 200], ["draft-root", 200], ["", 200], [null, 200], [undefined, 200],
    ["child", 400], ["foreign", 400], ["missing", 400],
  ] as const) {
    const before = pr5State.writes;
    const body = { ...(method === "POST" ? { name: "Fixture", tagline: "Fixture", description: "Fixture" } : {}), ...(binding !== undefined ? { hostedPageSlug: binding } : {}) };
    const response = method === "POST" ? await collection.POST(request(body, method))
      : await item.PUT(request(body, method), { params: Promise.resolve({ id: "existing" }) });
    assert.equal(response.status, expected === 200 && method === "POST" ? 201 : expected, `${method} ${binding}`);
    const json = await response.json();
    if (expected === 400) {
      assert.deepEqual(json.details[0].path, ["hostedPageSlug"]);
      assert.equal(pr5State.writes, before);
    } else {
      assert.equal(pr5State.writes, before + 1);
      if (binding === "" || binding === null) assert.equal(json.hostedPageSlug, null);
      else if (binding) assert.equal(json.hostedPageSlug, binding);
      else if (method === "PUT") assert.equal(json.hostedPageSlug, "root");
    }
  }
});
