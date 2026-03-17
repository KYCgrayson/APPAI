import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await db.hostedPage.findUnique({ where: { slug } });
  if (!page || !page.isPublished) return {};

  const logoUrl = page.content && typeof page.content === "object"
    ? (page.content as any).logo || (page.content as any).sections?.find((s: any) => s.type === "hero")?.data?.logo
    : null;

  return {
    title: `Terms of Service - ${page.title}`,
    description: `Terms of Service for ${page.title}`,
    icons: logoUrl ? { icon: logoUrl, apple: logoUrl } : undefined,
  };
}

export default async function TermsPage({ params }: Props) {
  const { slug } = await params;
  const page = await db.hostedPage.findUnique({ where: { slug } });

  if (!page || !page.isPublished || !page.termsOfService) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <nav className="border-b">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-2 text-sm text-gray-500">
          <a href={`/p/${slug}`} className="hover:text-gray-900 flex items-center gap-1.5">
            {(() => {
              const logo = page.content && typeof page.content === "object"
                ? (page.content as any).logo || (page.content as any).sections?.find((s: any) => s.type === "hero")?.data?.logo
                : null;
              return logo ? <img src={logo} alt="" className="w-5 h-5 rounded object-cover" /> : null;
            })()}
            {page.title}
          </a>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900">Terms of Service</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto py-16 px-6">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-8">{page.title}</p>
        <div className="prose prose-lg max-w-none whitespace-pre-wrap text-gray-700">
          {page.termsOfService}
        </div>
      </div>
      <footer className="py-8 text-center text-sm text-gray-400 border-t">
        <a href="https://appai.info" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">
          Hosted on AppAI
        </a>
      </footer>
    </div>
  );
}

export const revalidate = 60;
