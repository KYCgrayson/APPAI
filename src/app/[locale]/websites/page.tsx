import { platformMetadata } from "@/lib/platform-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return platformMetadata(params, "websites");
}

export const dynamic = "force-dynamic";

import { PlatformDirectory } from "@/components/PlatformDirectory";

export default async function WebsitesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; type?: string }>;
}) {
  const { category, type } = await searchParams;
  return <PlatformDirectory kind="websites" category={category} personalOnly={type === "personal"} />;
}
