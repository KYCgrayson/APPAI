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

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || page.tagline || undefined,
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
      {page.customCss && <style dangerouslySetInnerHTML={{ __html: page.customCss }} />}
      <PageRenderer page={page} />
    </>
  );
}

export const revalidate = 60;
