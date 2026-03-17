import { db } from "@/lib/db";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export default async function HostedPageLayout({ params, children }: Props) {
  const { slug } = await params;
  const page = await db.hostedPage.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      content: true,
      themeColor: true,
      heroImage: true,
      privacyPolicy: true,
      termsOfService: true,
      isPublished: true,
    },
  });

  if (!page || !page.isPublished) {
    return <>{children}</>;
  }

  const themeColor = page.themeColor || "#000000";
  const content = page.content as any;

  // Extract logo
  const logo = content?.logo
    || content?.sections?.find((s: any) => s.type === "hero")?.data?.logo
    || page.heroImage;

  // Extract download URLs
  const downloadSection = content?.sections?.find((s: any) => s.type === "download");
  const appStoreUrl = downloadSection?.data?.appStoreUrl || content?.appStoreUrl;
  const playStoreUrl = downloadSection?.data?.playStoreUrl || content?.playStoreUrl;
  const hasDownload = appStoreUrl || playStoreUrl;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <a href={`/p/${slug}`} className="flex items-center gap-3">
            {logo && (
              <img src={logo} alt={page.title} className="w-8 h-8 rounded-xl object-cover" />
            )}
            <span className="font-semibold text-lg">{page.title}</span>
          </a>
          <div className="flex items-center gap-4">
            {page.privacyPolicy && (
              <a href={`/p/${slug}/privacy`} className="text-sm text-gray-500 hover:text-gray-900 hidden sm:inline">
                Privacy
              </a>
            )}
            {page.termsOfService && (
              <a href={`/p/${slug}/terms`} className="text-sm text-gray-500 hover:text-gray-900 hidden sm:inline">
                Terms
              </a>
            )}
            {hasDownload && (
              <a
                href={appStoreUrl || playStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white px-4 py-1.5 rounded-full font-medium"
                style={{ backgroundColor: themeColor }}
              >
                Download
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-8 border-t">
        {(page.privacyPolicy || page.termsOfService) && (
          <div className="flex justify-center gap-6 mb-4 text-sm text-gray-500">
            {page.privacyPolicy && (
              <a href={`/p/${slug}/privacy`} className="hover:text-gray-800">
                Privacy Policy
              </a>
            )}
            {page.termsOfService && (
              <a href={`/p/${slug}/terms`} className="hover:text-gray-800">
                Terms of Service
              </a>
            )}
          </div>
        )}
        <div className="text-center text-sm text-gray-400">
          <a href="https://appai.info" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
            Hosted on AppAI
          </a>
        </div>
      </footer>
    </div>
  );
}
