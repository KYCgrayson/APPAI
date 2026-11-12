import test from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
import { registerVideoPlayerFixture, videoHooks } from "./helpers/video-player-fixture.mjs";
const loader = registerHostedRenderLoader();
const hooks = registerVideoPlayerFixture();
test.after(() => { hooks.deregister(); loader.deregister(); });
const { VideoPlayer } = await import("../src/templates/sections/VideoPlayer.tsx");
const { videoStrings } = await import("../src/templates/sections/video-strings.ts");
const { parseVideoUrl } = await import("../src/lib/video-url.ts");

class FixtureElement {
  dataset: Record<string, string> = {};
  closest(selector: string): unknown { return selector === "section" ? { contains: () => true } : this; }
  compareDocumentPosition() { return 4; }
  scrollIntoView() {}
  getAttribute() { return ""; }
}
function find(node: unknown, type: string): ReactElement<Record<string, unknown>> | undefined {
  if (!node || typeof node !== "object") return;
  const element = node as ReactElement<Record<string, unknown>>;
  if (element.type === type) return element;
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) { const result = find(child, type); if (result) return result; }
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

for (const kind of ["youtube", "vimeo", "file"] as const) test(`${kind}: real client lifecycle defers loading/seeking and exposes playback/fallback semantics`, async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const original = Object.getOwnPropertyDescriptors(globalThis);
  const document = new EventTarget();
  const window = Object.assign(new EventTarget(), {
    location: { href: "https://appai.info/p/fictional?t=90#intro", origin: "https://appai.info" },
    history: { pushState(_state: unknown, _title: string, url: URL) { window.location.href = url.href; } },
  });
  Object.assign(globalThis, { document, window, Element: FixtureElement });
  videoHooks.refs.length = 0; videoHooks.states.length = 0; videoHooks.effects.length = 0;
  const video = parseVideoUrl(kind === "youtube" ? "https://youtu.be/Abc_123-xyz" : kind === "vimeo" ? "https://vimeo.com/123/hash123" : "https://example.test/demo.mp4")!;
  const props = { video, sectionId: "intro", startAt: 0, title: "Fictional demo", themeColor: "#334455", strings: videoStrings("en") };
  const render = () => { videoHooks.refIndex = 0; videoHooks.stateIndex = 0; return VideoPlayer(props); };
  let cleanup: (() => void) | undefined;
  let plays = 0;
  const node = { readyState: 0, currentTime: 0, play: async () => { plays++; throw new Error("Fixture autoplay blocked"); } };
  const sent: { data: unknown; origin: string }[] = [];
  const frameWindow = { postMessage(data: unknown, origin: string) { sent.push({ data, origin }); } };
  try {
    const initial = render();
    assert.equal(find(initial, "iframe"), undefined);
    if (kind === "file") assert.ok(find(initial, "video"));
    videoHooks.refs[0].current = new FixtureElement();
    videoHooks.refs[2].current = node;
    cleanup = videoHooks.effects[0]();
    await flush();
    assert.equal(sent.length, 0);
    assert.equal(find(render(), "iframe"), undefined, "initial ?t= must retain the facade");
    const anchor = Object.assign(new FixtureElement(), { dataset: { videoTime: "90" }, target: "", href: video.url });
    const click = new Event("click", { cancelable: true });
    Object.assign(click, { button: 0 }); Object.defineProperty(click, "target", { value: anchor });
    document.dispatchEvent(click);
    assert.equal(click.defaultPrevented, true);
    const active = render();
    if (kind === "file") {
      assert.equal(node.currentTime, 0, "metadata not ready: do not seek yet");
      assert.equal(plays, 0);
      node.readyState = 1;
      (find(active, "video")!.props.onLoadedMetadata as () => void)();
      await flush();
      assert.equal(node.currentTime, 90);
      assert.equal(plays, 1);
      assert.equal(videoHooks.states[2].state, "blocked");
    } else {
      const frame = find(active, "iframe")!;
      assert.ok(frame);
      const src = new URL(frame.props.src as string);
      assert.equal(src.hostname, kind === "youtube" ? "www.youtube-nocookie.com" : "player.vimeo.com");
      if (kind === "youtube") { assert.equal(src.searchParams.get("enablejsapi"), "1"); assert.equal(src.searchParams.get("origin"), "https://appai.info"); }
      else assert.equal(src.searchParams.get("h"), "hash123");
      assert.equal(src.searchParams.has("autoplay"), false);
      assert.equal(frame.props.sandbox, "allow-scripts allow-same-origin allow-presentation");
      assert.equal(frame.props.referrerPolicy, "strict-origin-when-cross-origin");
      assert.equal(frame.props.allow, "autoplay; encrypted-media; picture-in-picture; fullscreen");
      assert.equal(frame.props.title, "Fictional demo");
      videoHooks.refs[1].current = { contentWindow: frameWindow };
      const deliver = (origin: string, source: unknown, data: Record<string, unknown> = kind === "youtube" ? { event: "onReady" } : { event: "ready" }) => {
        const event = new Event("message");
        Object.assign(event, { origin, source, data });
        window.dispatchEvent(event);
      };
      const origin = src.origin;
      deliver(origin + ".evil.test", frameWindow); deliver(origin, {}); await flush();
      assert.equal(sent.length, 0);
      if (kind === "youtube") {
        (frame.props.onLoad as () => void)();
        t.mock.timers.tick(250);
        assert.equal(sent.length, 1, "the click's first hello had no mounted frame; the next hello reaches it");
        deliver(origin, frameWindow, { event: "infoDelivery", info: { currentTime: 0, playerState: 2 } });
        deliver(origin, frameWindow, { event: "onAutoplayBlocked" });
        await flush();
        t.mock.timers.tick(500);
        assert.equal(sent.length, 1, "the first reply stops listening without flushing the seek");
        assert.equal(videoHooks.states[2].state, "loading");
      }
      deliver(origin, frameWindow); await flush();
      assert.ok(sent.some(message => JSON.stringify(message.data).includes(kind === "youtube" ? "seekTo" : "setCurrentTime")));
      assert.ok(sent.every(message => message.origin === origin));
      if (kind === "youtube") { t.mock.timers.tick(2000); t.mock.timers.tick(2000); }
      else t.mock.timers.tick(8000);
      assert.equal(videoHooks.states[2].state, "error");
    }
    cleanup?.(); cleanup = undefined;
  } finally {
    cleanup?.();
    for (const key of ["document", "window", "Element"]) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
