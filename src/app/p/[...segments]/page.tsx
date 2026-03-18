import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageRenderer } from "@/templates/shared/PageRenderer";
import { parsePageSegments, buildPagePath } from "@/lib/parse-page-segments";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ segments: string[] }>;
}

function extractLogo(page: any): string | null {
  const content = page.content as any;
  return content?.logo
    || content?.sections?.find((s: any) => s.type === "hero")?.data?.logo
    || page.heroImage
    || null;
}

function buildJsonLd(page: any, url: string) {
  const content = page.content as any;
  const downloadSection = content?.sections?.find((s: any) => s.type === "download");
  const platforms: string[] = [];
  if (downloadSection?.data?.appStoreUrl) platforms.push("iOS");
  if (downloadSection?.data?.playStoreUrl) platforms.push("Android");

  return {
    "@context": "https://schema.org",
    "@type": downloadSection ? "SoftwareApplication" : "WebPage",
    name: page.title,
    description: page.metaDescription || page.tagline || undefined,
    url,
    image: page.ogImage || page.heroImage || undefined,
    inLanguage: page.locale,
    ...(downloadSection
      ? {
          applicationCategory: "Application",
          operatingSystem: platforms.join(", ") || undefined,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }
      : {}),
  };
}

/** Resolve page from DB: explicit locale or default */
async function resolvePage(slug: string, explicitLocale: string | null) {
  if (explicitLocale) {
    return db.hostedPage.findFirst({
      where: { slug, locale: explicitLocale, isPublished: true },
    });
  }
  // No locale in URL — find the default, fallback to first
  return db.hostedPage.findFirst({
    where: { slug, isPublished: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params;
  const parsed = parsePageSegments(segments);
  if (!parsed || parsed.subpage) return {};

  const { slug, locale: explicitLocale } = parsed;
  const page = await resolvePage(slug, explicitLocale);
  if (!page) return {};

  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";
  const logoUrl = extractLogo(page);

  // Build hreflang alternates
  const variants = await db.hostedPage.findMany({
    where: { slug, isPublished: true },
    select: { locale: true, isDefault: true },
  });

  const languages: Record<string, string> = {};
  for (const v of variants) {
    languages[v.locale] = `${baseUrl}${buildPagePath(slug, v.locale, null, v.isDefault)}`;
  }
  const defaultVariant = variants.find((v) => v.isDefault) || variants[0];
  if (defaultVariant) {
    languages["x-default"] = `${baseUrl}${buildPagePath(slug, defaultVariant.locale, null, true)}`;
  }

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || page.tagline || undefined,
    icons: logoUrl ? { icon: logoUrl, apple: logoUrl } : undefined,
    openGraph: {
      title: page.metaTitle || page.title,
      description: page.metaDescription || page.tagline || undefined,
      images: page.ogImage ? [page.ogImage] : undefined,
      locale: page.locale,
    },
    alternates: {
      languages,
    },
  };
}

export default async function HostedPage({ params }: Props) {
  const { segments } = await params;
  const parsed = parsePageSegments(segments);
  if (!parsed) notFound();

  const { slug, locale: explicitLocale, subpage } = parsed;
  const page = await resolvePage(slug, explicitLocale);
  if (!page) notFound();

  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";
  const pageUrl = `${baseUrl}${buildPagePath(slug, page.locale, null, page.isDefault)}`;

  // Privacy subpage
  if (subpage === "privacy") {
    if (!page.privacyPolicy) notFound();
    return (
      <div className="max-w-3xl mx-auto py-16 px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <a href={buildPagePath(slug, page.locale, null, page.isDefault)} className="hover:text-gray-900">{page.title}</a>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900">Privacy Policy</span>
        </nav>
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">{page.title}</p>
        <div className="prose prose-lg max-w-none whitespace-pre-wrap text-gray-700">
          {page.privacyPolicy}
        </div>
      </div>
    );
  }

  // Terms subpage
  if (subpage === "terms") {
    if (!page.termsOfService) notFound();
    return (
      <div className="max-w-3xl mx-auto py-16 px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <a href={buildPagePath(slug, page.locale, null, page.isDefault)} className="hover:text-gray-900">{page.title}</a>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900">Terms of Service</span>
        </nav>
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-8">{page.title}</p>
        <div className="prose prose-lg max-w-none whitespace-pre-wrap text-gray-700">
          {page.termsOfService}
        </div>
      </div>
    );
  }

  // Main landing page
  const jsonLd = buildJsonLd(page, pageUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {page.customCss && <style>{page.customCss}</style>}
      <PageRenderer page={page} />
    </>
  );
}

export const revalidate = 60;
