import test from "node:test";
import assert from "node:assert/strict";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { hookEffects, registerIframeSessionHook } from "./helpers/iframe-session-hook-fixture.mjs";

const loader = registerHostedRenderLoader();
const hooks = registerIframeSessionHook();
test.after(() => { hooks.deregister(); loader.deregister(); });
const { useIframeToolSession } = await import("../src/templates/sections/use-iframe-tool-session.ts");

test("focus, pageshow, visibility and expiry share a queue; auth changes bypass it without reloading", async t => {
  let now = 0;
  const pageWindow = new EventTarget();
  const pageDocument = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const posted: unknown[] = [];
  const frame = Object.assign(new EventTarget(), { contentWindow: { postMessage: (...args: unknown[]) => { posted.push(args); } } });
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const channels: FakeChannel[] = [];
  class FakeChannel extends EventTarget {
    closed = false;
    name: string;
    constructor(name: string) { super(); this.name = name; channels.push(this); }
    close() { this.closed = true; }
  }
  // The hook only needs browser events, timers and a frame's messaging surface.
  const original = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, {
    window: pageWindow, document: pageDocument, BroadcastChannel: FakeChannel,
    setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id: number) => { timers.delete(id); },
  });
  let calls = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(JSON.stringify({ token: `renewed-${calls}`, expiresAt: new Date(now + 120_000).toISOString() }));
  });
  t.mock.method(Date, "now", () => now);
  const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  let cleanups: (() => void)[] = [];
  try {
    hookEffects.length = 0;
    const initial = useIframeToolSession({ current: frame as unknown as HTMLIFrameElement }, "https://tool.pages.dev", {
      token: "initial", expiresAt: new Date(120_000).toISOString(), pageId: "page", section: 2,
    });
    cleanups = hookEffects.map(effect => effect()).filter(Boolean);
    assert.equal(initial, "initial");
    pageWindow.dispatchEvent(new Event("focus"));
    pageWindow.dispatchEvent(new Event("pageshow"));
    pageDocument.dispatchEvent(new Event("visibilitychange"));
    await flush();
    assert.equal(calls, 1);
    assert.equal(JSON.parse(String(fetchMock.mock.calls[0].arguments[1]?.body)).section, 2);
    now = 29_999;
    pageWindow.dispatchEvent(new Event("focus"));
    await flush();
    assert.equal(calls, 1);
    now = 30_000;
    const timer = [...timers.values()][0];
    timers.clear();
    timer();
    await flush();
    assert.equal(calls, 2);
    assert.equal(channels[0].name, "next-auth");
    channels[0].dispatchEvent(new MessageEvent("message", { data: { event: "session" } }));
    await flush();
    assert.equal(calls, 3);
    frame.dispatchEvent(new Event("load"));
    assert.deepEqual(posted.at(-1), [{ type: "appai:session", token: "renewed-3", expiresAt: new Date(now + 120_000).toISOString() }, "https://tool.pages.dev"]);
    pageDocument.visibilityState = "hidden";
    now += 30_000;
    pageWindow.dispatchEvent(new Event("focus"));
    await flush();
    assert.equal(calls, 3);
    cleanups.forEach(cleanup => cleanup());
    cleanups = [];
    assert.equal(channels[0].closed, true);
    assert.equal(timers.size, 0);
    pageWindow.dispatchEvent(new Event("focus"));
    assert.equal(calls, 3);
  } finally {
    cleanups.forEach(cleanup => cleanup());
    for (const key of ["window", "document", "BroadcastChannel", "setTimeout", "clearTimeout"]) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
