import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { createElement } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { getTranslations } from "next-intl/server";
import { Breadcrumb } from "@/components/Breadcrumb";
import { gameBreadcrumbs } from "@/lib/games-page-seo";
import { getOwnGame, isPlayableGame } from "@/lib/games-catalog";
import { gameNavigationLocale, injectGameNavigation } from "@/lib/game-play-shell";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getOwnGame(slug);
  if (!game || !isPlayableGame(game)) return new Response("Not found", { status: 404 });
  const html = await readFile(join(process.cwd(), "public", "games", game.buildSlug, "index.html"), "utf8");
  const locale = gameNavigationLocale(new URL(request.url), request.cookies.get("NEXT_LOCALE")?.value);
  const t = await getTranslations({ locale, namespace: "breadcrumbs" });
  const prefix = locale === "en" ? "" : `/${locale}`;
  const items = gameBreadcrumbs(locale, slug).map(item => ({
    name: item.href === "/games" ? t("games") : item.name, href: `${prefix}${item.href}`,
  }));
  const breadcrumb = await new Response(await renderToReadableStream(createElement(Breadcrumb, {
    items, label: t("label"), variant: "platform", dark: true,
  }))).text();
  return new Response(injectGameNavigation(html, game, locale, breadcrumb), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}
