import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gameSectionSchema, gameContentIssues, gameSlugReserved, gamePageWarnings, gamesListingResponse } from "../src/lib/game-section.ts";
import { createPageSchema, updatePageSchema } from "../src/lib/validations/page.ts";
import { checkPagePreview } from "../src/lib/page-preview.ts";
import { sanitizePageContent } from "../src/lib/sanitize.ts";
import { buildJsonLd, hostedOgImage } from "../src/lib/hosted-page-seo.ts";
import { RESERVED_GAME_SLUGS } from "../src/lib/games-catalog.ts";

const example = JSON.parse(readFileSync(new URL("../docs/examples/game.example.json", import.meta.url), "utf8"));
const data = example.content.sections[0].data;
const pageWith = (changes: Record<string, unknown>, template = "GAME") => ({ ...example, template, content: { ...example.content, sections: [{ type: "game", order: 0, data: { ...data, ...changes } }] } });

test("GAME example and standalone game sections accept all supported hosts", () => {
  assert.ok(createPageSchema.safeParse(example).success);
  for (const host of ["original.github.io", "original.pages.dev", "original.vercel.app", "original.netlify.app"]) {
    assert.ok(gameSectionSchema.safeParse({ ...data, gameUrl: `https://${host}/game` }).success);
  }
  assert.ok(createPageSchema.safeParse(pageWith({}, "APP_LANDING")).success);
  assert.ok(gameSectionSchema.safeParse({ gameUrl: data.gameUrl, howToPlay: ["Tap a shape."] }).success);
  assert.ok(updatePageSchema.safeParse({ content: { sections: [{ type: "game", data: { description: "Updated" } }] } }).success);
  assert.ok(gameContentIssues({ sections: [{ type: "game", data: { description: "Updated" } }] }).length);
});

test("game validation rejects invalid URLs, enums, ranges and bounds", () => {
  const bad: Record<string, unknown>[] = [
    ...["http://original.pages.dev/", "https://example.com", "https://pages.dev", "https://original.pages.dev.example.com", "javascript:alert(1)", ""].map(gameUrl => ({ gameUrl })),
    { gameUrl: undefined }, { orientation: "square" }, { aspectRatio: "0:9" }, { aspectRatio: "100:9" },
    { players: { min: 4, max: 2 } }, { players: { min: 0, max: 2 } }, { players: { min: 1, max: 17 } },
    { players: { min: 1.5, max: 2 } }, { controls: [] }, { controls: ["mouse"] }, { controls: ["touch", "touch"] },
    { howToPlay: [] }, { howToPlay: undefined }, { howToPlay: Array(11).fill("Tap") }, { howToPlay: [" "] }, { howToPlay: ["x".repeat(501)] },
    { ageRating: "18+" }, { cover: { url: "invalid-url", alt: "Cover" } }, { cover: { url: "http://example.com/cover.png", alt: "Cover" } }, { cover: { url: "https://example.com/c.png", alt: "" } },
    { description: "x".repeat(2001) }, { genre: "x".repeat(101) }, { heading: "x".repeat(201) },
    { faq: Array(21).fill({ question: "Why?", answer: "Because." }) }, { faq: [{ question: "x".repeat(301), answer: "Yes" }] },
    { listInGames: "yes" }, { identity: "true" }, { access: "public" },
  ];
  for (const changes of bad) assert.equal(createPageSchema.safeParse(pageWith(changes)).success, false, JSON.stringify(changes));
});

test("catalog slugs are reserved for both GAME templates and games on other templates", () => {
  for (const slug of RESERVED_GAME_SLUGS) for (const template of ["GAME", "APP_LANDING"]) {
    const page = { ...pageWith({}, template), slug };
    assert.ok(gameSlugReserved(page));
    assert.equal(createPageSchema.safeParse(page).success, false);
    assert.equal(checkPagePreview(page).valid, false);
  }
  assert.equal(gameSlugReserved({ slug: RESERVED_GAME_SLUGS[0], template: "APP_LANDING", content: {} }), false);
});

test("dry-run warns about URL, H1, steps, description and every missing listing field", () => {
  const body = pageWith({ gameUrl: "https://example.com", howToPlay: [], description: undefined }, "APP_LANDING");
  const result = checkPagePreview(body);
  assert.equal(result.valid, false);
  for (const match of [/gameUrl/, /H1/, /howToPlay/, /description/]) assert.ok(result.warnings.some(w => match.test(w.message)), String(match));
  for (const field of ["description", "genre", "orientation", "aspectRatio", "players", "controls", "ageRating", "cover"]) {
    const preview = checkPagePreview(pageWith({ [field]: undefined }));
    assert.ok(preview.warnings.some(w => w.path.endsWith("listInGames") && w.message.includes(field)), field);
  }
  assert.ok(checkPagePreview({ ...example, content: { sections: [] } }).warnings.some(w => /game section/.test(w.message)));
  assert.ok(!checkPagePreview(example).warnings.some(w => /H1/.test(w.message)));
  const stripped = checkPagePreview(pageWith({ howToPlay: ["<b></b>"] }));
  assert.equal(stripped.valid, false);
  assert.match(stripped.next, /Fix errors/);
});

test("leaderboards are format-only warnings and never provision a board", () => {
  for (const leaderboards of [null, {}, [{ id: "UPPER", name: "Top", sortOrder: "desc" }], [{ id: "top", name: "Top", sortOrder: "wrong" }], Array(11).fill({ id: "top", name: "Top", sortOrder: "desc" })]) {
    const result = checkPagePreview(pageWith({ leaderboards }));
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some(w => /Invalid leaderboards format|Expected array/.test(w.message)));
  }
  const valid = pageWith({ leaderboards: [{ id: "fastest", name: "Fastest", sortOrder: "asc", unit: "seconds" }] });
  assert.ok(checkPagePreview(valid).warnings.some(w => /stored only/.test(w.message)));
});

test("listing receipt is derived and persisted in JSON without accepting a supplied decision", () => {
  const saved = sanitizePageContent({ ...example.content, gamesListing: "approved" });
  assert.deepEqual(gamesListingResponse(saved), { gamesListing: "requested" });
  assert.equal(saved.gamesListing, "requested");
  assert.equal(checkPagePreview(example).gamesListing, "requested");
  const withdrawn = sanitizePageContent({ ...pageWith({ listInGames: false }).content, gamesListing: "requested" });
  assert.equal(withdrawn.gamesListing, undefined);
  assert.deepEqual(gamesListingResponse(withdrawn), {});
  assert.deepEqual(gamePageWarnings(pageWith({ listInGames: false, cover: undefined })), []);
});

test("VideoGame JSON-LD reflects the game, locale and hosted URL without a free Offer", () => {
  const page = { ...example, content: sanitizePageContent(example.content) };
  const url = "https://appai.info/p/little-pattern-trail";
  const result = buildJsonLd(page, url, "https://appai.info", null);
  const game = result["@graph"].find(node => node["@type"] === "VideoGame");
  assert.ok(game);
  assert.deepEqual({ name: game.name, description: game.description, genre: game.genre, gamePlatform: game.gamePlatform, playMode: game.playMode, numberOfPlayers: game.numberOfPlayers, audience: game.audience, inLanguage: game.inLanguage, url: game.url }, {
    name: example.title, description: data.description, genre: "Puzzle", gamePlatform: "Web browser", playMode: ["SinglePlayer", "MultiPlayer"],
    numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2 }, audience: { "@type": "PeopleAudience", suggestedMinAge: 0 }, inLanguage: "en", url,
  });
  assert.equal(hostedOgImage(page), data.cover.url);
  const mixed = { ...page, content: { sections: [...example.content.sections, { type: "download", data: { appStoreUrl: "https://example.com" } }] } };
  assert.doesNotMatch(JSON.stringify(buildJsonLd(mixed, url, "https://appai.info", null)), /"offers"|"Offer"/);
  for (const [ageRating, age] of [["7+", 7], ["12+", 12]] as const) {
    const schema = buildJsonLd(pageWith({ ageRating, players: { min: 2, max: 4 } }), url, "https://appai.info", null)["@graph"].find(node => node["@type"] === "VideoGame");
    assert.equal(schema?.audience.suggestedMinAge, age);
    assert.deepEqual(schema?.playMode, ["MultiPlayer"]);
  }
});

test("spec-only GAME body passes dry-run and the new topic route serves it", async () => {
  const doc = readFileSync(new URL("../docs/spec/games.md", import.meta.url), "utf8");
  const body = JSON.parse(doc.match(/```json\n([\s\S]*?)\n```/)![1]);
  const result = checkPagePreview(body);
  assert.equal(result.valid, true);
  assert.ok(result.warnings.every(w => /Replace demo/.test(w.message)), JSON.stringify(result.warnings));
  assert.match(doc, /## Leaderboards\n\nComing soon\n/);
  const { registerHostedRenderLoader } = await import("./helpers/hosted-render-loader.mjs");
  const hooks = registerHostedRenderLoader();
  try {
    const { GET } = await import("../src/app/spec/[topic]/route.ts");
    const response = await GET(new Request("https://appai.info/spec/games"), { params: Promise.resolve({ topic: "games" }) });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), doc);
  } finally { hooks.deregister(); }
});


test("game identity remains boolean-validated but true warns without blocking preview", () => {
  for (const identity of [true, false]) {
    const result = checkPagePreview(pageWith({ identity }));
    assert.equal(result.valid, true);
    assert.equal((result.sanitizedContent?.sections as { data: { identity?: boolean } }[])[0].data.identity, identity);
    assert.equal(result.warnings.some(w => w.message === "identity is not available for games until they are approved"), identity);
  }
  assert.equal(checkPagePreview(pageWith({ identity: "true" })).valid, false);
});

test("demo game covers ask for game images while tool screenshots keep their guidance", () => {
  const warnings = checkPagePreview(example).warnings;
  const cover = warnings.find(w => w.path.endsWith("(game).data.cover.url"));
  assert.ok(cover);
  assert.match(cover.message, /Replace demo cover.*game artwork/);
  assert.doesNotMatch(cover.message, /user’s app/);
  const app = checkPagePreview({ ...example, template: "APP_LANDING", content: { ...example.content, sections: [{ type: "screenshots", data: { images: [data.cover.url] } }] } });
  assert.ok(app.warnings.some(w => /real screenshot of the user’s app/.test(w.message)));
});

test("game spec describes current identity, permission, compliance and host contracts", () => {
  const doc = readFileSync(new URL("../docs/spec/games.md", import.meta.url), "utf8");
  assert.match(doc, /leaderboards declarations are stored only.*warning may remain/);
  assert.match(doc, /Login or payment forms/);
  assert.match(doc, /Asking users to paste or execute commands/);
  assert.match(doc, /Only approved origins can call the room API from a browser/);
  assert.match(doc, /must start and end with a letter or digit/);
  assert.match(doc, /supply translated `privacyPolicy` and `termsOfService`/);
  assert.match(doc, /optional in API validation.*does not automatically write or provide/);
  assert.match(doc, /Loaded directly from this image host; visitors’ IP addresses are visible/);
  assert.match(doc, /currently receive no AppAI identity or session token/);
  assert.doesNotMatch(doc, /Identity exposes|same identity semantics|identity opt-in only|existing iframe-tool sandbox/);
  for (const path of ["../skills/appai-publish/SKILL.md", "../src/app/llms.txt/route.ts"]) {
    const guidance = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(guidance, /Only approved origins can call.*from a browser/);
    assert.match(guidance, /games currently receive no AppAI session|currently receive no AppAI identity or session/);
    assert.doesNotMatch(guidance, /Only approved games|game session is sent|opts in to iframe-tool sessions delivered over postMessage/);
  }
  const tools = readFileSync(new URL("../docs/spec/tools.md", import.meta.url), "utf8");
  assert.match(tools, /Only approved origins can call this API from a browser/);
  assert.match(tools, /must start and end with a letter or digit/);
});

test("GAME privacy and terms are optional fields and never automatically populated", () => {
  const parsed = createPageSchema.parse(example);
  assert.equal(parsed.privacyPolicy, undefined);
  assert.equal(parsed.termsOfService, undefined);
  const supplied = createPageSchema.parse({ ...example, privacyPolicy: "Privacy copy", termsOfService: "Terms copy" });
  assert.equal(supplied.privacyPolicy, "Privacy copy");
  assert.equal(supplied.termsOfService, "Terms copy");
});
