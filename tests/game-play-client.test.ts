import test from "node:test";
import assert from "node:assert/strict";
import { registerHostedRenderLoader, registerPlayCompatibilityEffects } from "./helpers/hosted-render-loader.mjs";
import { renderHtml } from "./helpers/render-html.mjs";

const effects: Array<() => void> = [];
const key = Symbol.for("appai.test.play-effects");
Object.defineProperty(globalThis, key, { value: effects, configurable: true });
const loader = registerHostedRenderLoader();
// Run the component's actual mount effect against a location fixture, without a DOM.
const hooks = registerPlayCompatibilityEffects();
const { GamePlayCompatibility } = await import("../src/components/GamePlayCompatibility.tsx");
test.after(() => { hooks.deregister(); loader.deregister(); Reflect.deleteProperty(globalThis, key); });

test("mount replaces old room/hash links with the exact query and fragment, without a locale prefix", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const [slug, search, hash, redirects] of [
      ["guess-duel", "?locale=zh-TW&tag=a%2fb", "#r=abc_DEF-123", true],
      ["guess-duel", "", "#r=", true],
      ["guess-duel", "?room=AB%20CD&room=EF%2bGH", "#r=payload", true],
      ["river-crossing", "?game=bridge&level=hard", "#resume", true],
      ["night-bridge", "?game=water&locale=zh-CN", "#resume", true],
      ["water-pouring", "?locale=zh-TW&tag=a%2fb", "#r=payload", true],
      ["werewolf", "?lang=zh", "#state", true],
      ["werewolf", "?lang=zh", "", false],
      ["river-crossing", "?locale=zh-TW", "", false],
      ["guess-duel", "", "", false],
    ] as const) {
      const replacements: string[] = [];
      Object.defineProperty(globalThis, "window", { configurable: true, value: {
        location: { pathname: `/zh-TW/games/${slug}`, search, hash, replace: (url: string) => replacements.push(url) },
      } });
      const playHref = `/games/${slug}/play${search}`;
      const element = GamePlayCompatibility({ slug, playHref, label: "Play" });
      assert.deepEqual(replacements, [], "navigation waits for mount");
      effects.shift()!();
      assert.deepEqual(replacements, redirects ? [`/games/${slug}/play${search}${hash}`] : []);
      const html = await renderHtml(element);
      assert.ok(html.includes("<noscript><a href="));
      assert.ok(html.includes(">Play</a></noscript>"));
    }
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
