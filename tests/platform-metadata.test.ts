import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToPipeableStream, renderToStaticMarkup } from "react-dom/server";
import { PassThrough } from "node:stream";
import { registerHostedRenderLoader, registerDirectoryFixtures, fixtureDb } from "./helpers/hosted-render-loader.mjs";

const hooks = registerHostedRenderLoader();
const intl = registerDirectoryFixtures({ translated: true });
test.after(() => { intl.deregister(); hooks.deregister(); });

test("platform route generateMetadata reads the nine message files", async () => {
  const routes = [await import("../src/app/[locale]/page.tsx"), await import("../src/app/[locale]/tools/page.tsx"),
    await import("../src/app/[locale]/apps/page.tsx"), await import("../src/app/[locale]/websites/page.tsx")];
  for (const route of routes) {
    const titles = new Set();
    const descriptions = new Set();
    for (const locale of ["en", "ja", "ko", "zh-CN", "zh-TW", "de", "fr", "es", "hi"]) {
      const metadata = await route.generateMetadata({ params: Promise.resolve({ locale }) });
      titles.add(metadata.title); descriptions.add(metadata.description);
    }
    assert.equal(titles.size, 9);
    assert.equal(descriptions.size, 9);
  }
});

test("all nine homepage headings SSR with expected copy, phrase breaks and wrapping classes", async () => {
  const { default: HomePage } = await import("../src/app/[locale]/page.tsx");
  fixtureDb.apps = [];
  fixtureDb.rows = [];
  const expectedHeadings = {
    en: ["Host your AI app free", "for developers and\u00a0agents"],
    ja: ["AIアプリを<wbr/>無料で<wbr/>ホスティング", "開発者と<wbr/>エージェント向け"],
    ko: ["AI 앱을 무료로 호스팅하세요", "개발자와 에이전트를 위한 공간"],
    "zh-CN": ["免费托管 AI app", "为开发者<wbr/>与 agent<wbr/>打造"],
    "zh-TW": ["免費託管 AI app", "為開發者<wbr/>與 agent<wbr/>打造"],
    de: ["Deine KI-App kostenlos hosten", "für Entwickler und\u00a0Agenten"],
    fr: ["Hébergez votre app IA gratuitement", "pour les développeurs et\u00a0les\u00a0agents"],
    es: ["Aloja tu app de IA gratis", "para desarrolladores y\u00a0agentes"],
    hi: ["अपना AI ऐप मुफ़्त होस्ट करें", "डेवलपर और एजेंट के लिए"],
  };
  for (const [locale, [title1, title2]] of Object.entries(expectedHeadings)) {
    fixtureDb.locale = locale;
    const element = await HomePage();
    const html = await new Promise<string>((resolve, reject) => {
      const output = new PassThrough();
      const chunks: string[] = [];
      output.on("data", chunk => chunks.push(chunk.toString()));
      output.on("end", () => resolve(chunks.join("")));
      output.on("error", reject);
      const rendering = renderToPipeableStream(element, { onAllReady() { rendering.pipe(output); }, onError: reject });
    });
    const headings = [...html.matchAll(/<h1\b[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/h1>/g)];
    assert.equal(headings.length, 1, locale);
    const [, className, heading] = headings[0];
    assert.match(className, /\btext-balance\b/, locale);
    if (["ja", "ko", "zh-CN", "zh-TW"].includes(locale)) {
      assert.ok(className.includes("[word-break:keep-all]"), locale);
      assert.doesNotMatch(className, /break-words|overflow-wrap:anywhere/, locale);
    } else {
      assert.doesNotMatch(className, /word-break:keep-all/, locale);
      assert.ok(className.includes("[overflow-wrap:anywhere]"), locale);
      assert.doesNotMatch(className, /\bbreak-words\b/, locale);
    }
    assert.match(heading, /<br\/>/); // No responsive class hides this break on phones.
    assert.doesNotMatch(heading, /&lt;wbr|home\.heroTitle/);
    assert.ok(heading.startsWith(title1), locale);
    assert.equal(heading.match(/<span class="text-cyan-400">([\s\S]*?)<\/span>/)?.[1], title2, locale);
    assert.equal((heading.match(/<wbr\/>/g) ?? []).length, ((title1 + title2).match(/<wbr\/>/g) ?? []).length, locale);
  }
});

test("app detail canonical, social and JSON-LD URLs include /apps/ in every locale", async () => {
  const { default: AppDetail, generateMetadata } = await import("../src/app/[locale]/apps/[id]/page.tsx");
  fixtureDb.apps = [{ id: "example", name: "Example", tagline: "Example app", isApproved: true,
    hostedPageSlug: null, appType: null, category: "OTHER", tags: [], screenshots: [] }];
  for (const locale of ["en", "ja", "ko", "zh-CN", "zh-TW", "de", "fr", "es", "hi"]) {
    fixtureDb.locale = locale;
    const params = Promise.resolve({ locale, id: "example" });
    const metadata = await generateMetadata({ params });
    const url = `https://appai.info${locale === "en" ? "" : `/${locale}`}/apps/example`;
    assert.equal(metadata.alternates?.canonical, url);
    assert.equal(metadata.openGraph?.url, url);
    assert.match(metadata.openGraph?.locale ?? "", /^[a-z]{2}_[A-Z]{2}$/, locale);
    const element = await AppDetail({ params });
    const html = await new Promise<string>((resolve, reject) => {
      const output = new PassThrough();
      const chunks: string[] = [];
      output.on("data", chunk => chunks.push(chunk.toString()));
      output.on("end", () => resolve(chunks.join("")));
      const stream = renderToPipeableStream(createElement("div", null, element), {
        onAllReady() { stream.pipe(output); }, onError: reject,
      });
    });
    assert.ok(html.includes(`"url":"${url}"`));
  }
});

test("login, launcher and error surfaces carry noindex", async () => {
  const login = await import("../src/app/[locale]/login/page.tsx");
  const launcher = await import("../src/app/app/layout.tsx");
  assert.equal((login.metadata.robots as { index: boolean }).index, false);
  assert.equal((launcher.metadata.robots as { index: boolean }).index, false);
  const { default: NotFound } = await import("../src/app/not-found.tsx");
  const { default: ErrorPage } = await import("../src/app/error.tsx");
  const { default: GlobalError } = await import("../src/app/global-error.tsx");
  const props = { error: new Error("Example"), reset() {} };
  for (const element of [createElement(NotFound), createElement(ErrorPage, props), createElement(GlobalError, props)]) {
    assert.match(renderToStaticMarkup(element), /name="robots" content="noindex, nofollow"/);
  }
});
