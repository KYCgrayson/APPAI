import { hostedPagePath, type HostedUrlPage } from "./hosted-page-urls.ts";
import { pickByLocale } from "./locale-match.ts";
import type { BreadcrumbItem } from "./breadcrumbs.ts";

type NamedPage = HostedUrlPage & { title: string };

export function hostedBreadcrumbs(root: NamedPage, roots: readonly NamedPage[], locale: string, current: BreadcrumbItem): BreadcrumbItem[] {
  const localizedRoot = root.locale === locale ? root : pickByLocale(roots, locale) ?? root;
  return [{ name: localizedRoot.title, href: hostedPagePath(localizedRoot, roots)! }, current];
}
