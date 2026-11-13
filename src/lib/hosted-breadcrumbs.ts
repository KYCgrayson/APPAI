import { db } from "@/lib/db";
import { hostedPagePath, type HostedUrlPage } from "./hosted-page-urls.ts";
import { pickByLocale } from "./locale-match.ts";
import { locales } from "../i18n/routing.ts";
import { publicAppFilter, publicPageWhere } from "./hosted-page-visibility.ts";
import { appDirectoryKind } from "./directory-kind.ts";
import { hostedNavigationCopy } from "./hosted-navigation-copy.ts";
import type { BreadcrumbItem } from "./breadcrumbs.ts";

type NamedPage = HostedUrlPage & { title: string; organizationId: string };
const platformLocales = locales.map(locale => ({ locale, isDefault: locale === "en" }));

/** Public listing membership and taxonomy are the same as the platform directory. */
export async function hostedBreadcrumbs(root: NamedPage, roots: readonly NamedPage[], locale: string, current?: BreadcrumbItem): Promise<BreadcrumbItem[]> {
  const localizedRoot = root.locale === locale ? root : pickByLocale(roots, locale) ?? root;
  const platformLocale = pickByLocale(platformLocales, locale)!.locale;
  const prefix = platformLocale === "en" ? "" : `/${platformLocale}`;
  const copy = hostedNavigationCopy(locale);
  // Read all public variants so a translated root cannot change its category.
  const variants = await db.hostedPage.findMany({
    where: { slug: root.slug, organizationId: root.organizationId, ...publicPageWhere() },
    orderBy: [{ slug: "asc" }, { locale: "asc" }],
  });
  const app = await db.app.findFirst({ where: {
    hostedPageSlug: root.slug, organizationId: root.organizationId, ...publicAppFilter(variants),
  }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const kind = app ? appDirectoryKind(app, variants) : null;
  return [
    { name: copy.appai, href: `${prefix}/` },
    ...(kind ? [{ name: copy[kind], href: `${prefix}/${kind}` }] : []),
    { name: localizedRoot.title, href: hostedPagePath(localizedRoot, roots)! },
    ...(current ? [current] : []),
  ];
}
