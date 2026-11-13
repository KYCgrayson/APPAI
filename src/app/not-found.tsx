import Link from "next/link";
import { headers } from "next/headers";
import { parsePageSegments } from "@/lib/parse-page-segments";
import { resolvePage } from "@/lib/hosted-page-resolver";
import { hostedPagePath } from "@/lib/hosted-page-urls";
import { hostedNavigationCopy, hostedLinkFocus } from "@/lib/hosted-navigation-copy";

export default async function NotFound() {
  // Supplied (and overwritten) by middleware, never taken from a query string.
  // Recover the root even for malformed/deeper paths under an existing site.
  const hostedPath = (await headers()).get("x-appai-hosted-path");
  const segments = hostedPath?.startsWith("/p/") ? hostedPath.slice(3).split("/") : [];
  const layoutPath = parsePageSegments(segments);
  const parsed = layoutPath ?? parsePageSegments(segments.slice(0, 2)) ?? parsePageSegments(segments.slice(0, 1));
  // resolvePage applies publicPageWhere from hosted-page-visibility. Never
  // expose a draft/unpublished root's name or link, even on a known child URL.
  const root = parsed ? await resolvePage(parsed.slug, parsed.locale)
    ?? (parsed.locale ? await resolvePage(parsed.slug, null) : null) : null;
  const rootHref = root ? hostedPagePath(root, [root]) : null;
  const locale = root?.locale ?? parsed?.locale ?? "en";
  const copy = hostedNavigationCopy(locale);
  // Only use a section when the hosted layout actually supplies <main>.
  // Unknown/unpublished roots, unavailable locales, malformed paths and
  // fullscreen tools bypass that layout wrapper.
  const hasLayoutMain = layoutPath && layoutPath.toolOrder === null
    && await resolvePage(layoutPath.slug, layoutPath.locale);
  const Container = hasLayoutMain ? "section" : "main";
  return <Container lang={locale} className="mx-auto max-w-xl px-6 py-24">
    <meta name="robots" content="noindex, nofollow" />
    <h1 className="text-3xl font-bold">{copy.notFound}</h1>
    <p className="my-4">{copy.unavailable}</p>
    <div className="flex flex-wrap gap-4">
      {rootHref && <Link href={rootHref} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-gray-700 underline hover:text-gray-900 ${hostedLinkFocus}`}>{copy.home}</Link>}
      <Link href="/" className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-gray-700 underline hover:text-gray-900 ${hostedLinkFocus}`}>{copy.appai}</Link>
    </div>
  </Container>;
}

