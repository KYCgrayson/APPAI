import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { PlatformHeader } from "@/components/PlatformHeader";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params;
  const app = await db.app.findUnique({ where: { id } });
  if (!app) return {};

  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";
  const title = `${app.name} - AppAI`;
  const description = app.tagline || undefined;
  const image = app.logoUrl || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
      type: "website",
      url: `${baseUrl}/${locale}/apps/${id}`,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
    alternates: {
      canonical: `${baseUrl}/apps/${id}`,
    },
  };
}

export default async function AppDetailPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("appDetail");
  const app = await db.app.findUnique({ where: { id } });

  if (!app || !app.isApproved) {
    notFound();
  }

  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: app.name,
    description: app.tagline || app.description || undefined,
    url: `${baseUrl}/${id}`,
    image: app.logoUrl || undefined,
    applicationCategory: app.category || "Application",
    ...(app.iosUrl || app.androidUrl
      ? {
          operatingSystem: [
            ...(app.iosUrl ? ["iOS"] : []),
            ...(app.androidUrl ? ["Android"] : []),
          ].join(", "),
        }
      : {}),
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-xl font-bold flex items-center gap-2">
            <img src="/appai-logo2.png" alt="AppAI" className="w-7 h-7 rounded" />
            AppAI
          </Link>
          <span className="text-gray-300">/</span>
          <Link href="/apps" className="text-sm text-gray-600 hover:text-black">
            {t("apps")}
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start gap-6 mb-8">
          {app.logoUrl ? (
            <img
              src={app.logoUrl}
              alt={app.name}
              className="w-20 h-20 rounded-2xl object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500">
              {app.name[0]}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{app.name}</h1>
            <p className="text-lg text-gray-600 mt-1">{app.tagline}</p>
            <div className="flex gap-2 mt-2">
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                {app.category}
              </span>
              {app.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Download buttons */}
        <div className="flex gap-3 mb-8">
          {app.iosUrl && (
            <a
              href={app.iosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800"
            >
              {t("appStore")}
            </a>
          )}
          {app.androidUrl && (
            <a
              href={app.androidUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800"
            >
              {t("googlePlay")}
            </a>
          )}
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 px-6 py-3 rounded-xl hover:bg-gray-50"
            >
              {t("website")}
            </a>
          )}
        </div>

        {/* Description */}
        <div className="prose max-w-none whitespace-pre-wrap text-gray-700">
          {app.description}
        </div>

        {/* Screenshots */}
        {app.screenshots.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4">{t("screenshots")}</h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {app.screenshots.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Screenshot ${i + 1}`}
                  className="rounded-xl shadow h-[400px] w-auto object-cover flex-shrink-0"
                />
              ))}
            </div>
          </div>
        )}

        {/* Link to hosted page */}
        {app.hostedPageSlug && (
          <div className="mt-8 p-4 bg-gray-50 rounded-xl">
            <a
              href={`/p/${app.hostedPageSlug}`}
              className="text-blue-600 hover:underline"
            >
              {t("viewHostedPage")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
