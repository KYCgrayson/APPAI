import { loadHostedMembership } from "./public-hosted-page";
import { hostedPagePath, type HostedUrlPage } from "./hosted-page-urls.ts";
import { pickByLocale } from "./locale-match.ts";
import { locales } from "../i18n/routing.ts";
import { getDirectoryCopy } from "./directory-copy.ts";
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
  const membership = await loadHostedMembership(root.organizationId, root.slug);
  const kind = membership?.kind;
  const category = membership?.personal
    ? { name: getDirectoryCopy(platformLocale).personalPages, href: `${prefix}/websites?type=personal` }
    : kind ? { name: copy[kind], href: `${prefix}/${kind}` } : null;
  return [
    { name: copy.appai, href: `${prefix}/` },
    ...(category ? [category] : []),
    { name: localizedRoot.title, href: hostedPagePath(localizedRoot, roots)! },
    ...(current ? [current] : []),
  ];
}
