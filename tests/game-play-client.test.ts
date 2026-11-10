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
const { GamePlayCompatibility, GamePlayLink } = await import("../src/components/GamePlayCompatibility.tsx");
test.after(() => { hooks.deregister(); loader.deregister(); Reflect.deleteProperty(globalThis, key); });

test("mount keeps the exact query and fragment and carries the locale in the game's language parameter", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const [slug, search, hash, language] of [
      ["guess-duel", "?locale=zh-TW&tag=a%2fb", "#r=abc_DEF-123", ""],
      ["guess-duel", "", "#r=", "?locale=zh-TW"],
      ["guess-duel", "?room=AB%20CD&room=EF%2bGH", "#r=payload", "&locale=zh-TW"],
      ["river-crossing", "?game=bridge&level=hard", "#resume", "&locale=zh-TW"],
      ["night-bridge", "?game=water&locale=zh-CN", "#resume", ""],
      ["water-pouring", "?locale=zh-TW&tag=a%2fb", "#r=payload", ""],
      ["werewolf", "?lang=zh", "#state", ""],
      ["werewolf", "", "#state", "?lang=zh"],
      ["werewolf", "?locale=zh-TW", "#state", "&lang=zh"],
      ["werewolf", "?lang=zh", "", null],
      ["river-crossing", "?locale=zh-TW", "", null],
      ["guess-duel", "", "", null],
    ] as const) {
      const replacements: string[] = [];
      Object.defineProperty(globalThis, "window", { configurable: true, value: {
        location: { pathname: `/zh-TW/games/${slug}`, search, hash, replace: (url: string) => replacements.push(url) },
      } });
      const playHref = `/games/${slug}/play${search}`;
      const element = GamePlayCompatibility({ slug, playHref, label: "Play" });
      assert.deepEqual(replacements, [], "navigation waits for mount");
      effects.shift()!();
      assert.deepEqual(replacements, language !== null ? [`/games/${slug}/play${search}${language}${hash}`] : []);
      const html = await renderHtml(element);
      assert.ok(html.includes("<noscript><a href="));
      assert.ok(html.includes(">Play</a></noscript>"));
    }
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("language-only legacy queries customize Play on click while the page stays static", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const [slug, search, href, expected] of [
      ["river-crossing", "?locale=zh-TW", "/games/river-crossing/play?locale=en&game=river", "/games/river-crossing/play?locale=zh-TW&game=river"],
      ["guess-duel", "?locale=ja", "/games/guess-duel/play?locale=en", "/games/guess-duel/play?locale=ja"],
      ["werewolf", "?lang=zh", "/games/werewolf/play?lang=en", "/games/werewolf/play?lang=zh"],
      ["werewolf", "?locale=zh-TW", "/games/werewolf/play?lang=en", "/games/werewolf/play?lang=zh"],
    ]) {
      Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://appai.info", search } } });
      const link = GamePlayLink({ slug, href, children: "Play" });
      assert.equal(link.props.href, href);
      const event = { currentTarget: { href } };
      link.props.onClick(event);
      assert.equal(event.currentTarget.href, expected);
    }
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
