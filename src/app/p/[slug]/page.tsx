import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageRenderer } from "@/templates/shared/PageRenderer";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await db.hostedPage.findUnique({ where: { slug } });

  if (!page || !page.isPublished) return {};

  // Use project logo as favicon if available
  const logoUrl = page.content && typeof page.content === "object"
    ? (page.content as any).logo || (page.content as any).sections?.find((s: any) => s.type === "hero")?.data?.logo
    : null;

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || page.tagline || undefined,
    icons: logoUrl ? { icon: logoUrl, apple: logoUrl } : undefined,
    openGraph: {
      title: page.metaTitle || page.title,
      description: page.metaDescription || page.tagline || undefined,
      images: page.ogImage ? [page.ogImage] : undefined,
    },
  };
}

export default async function HostedPage({ params }: Props) {
  const { slug } = await params;
  const page = await db.hostedPage.findUnique({ where: { slug } });

  if (!page || !page.isPublished) {
    notFound();
  }

  return (
    <>
      {page.customCss && <style>{page.customCss}</style>}
      <PageRenderer page={page} />
    </>
  );
}

export const revalidate = 60;
