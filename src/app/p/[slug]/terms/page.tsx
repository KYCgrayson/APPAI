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

  return {
    title: `Terms of Service - ${page.title}`,
    description: `Terms of Service for ${page.title}`,
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
      <div className="max-w-3xl mx-auto py-16 px-6">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-8">{page.title}</p>
        <div className="prose prose-lg max-w-none whitespace-pre-wrap text-gray-700">
          {page.termsOfService}
        </div>
      </div>
      <footer className="py-8 text-center text-sm text-gray-400 border-t">
        Hosted on AIGA
      </footer>
    </div>
  );
}

export const revalidate = 60;
