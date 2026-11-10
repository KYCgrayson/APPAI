import { platformMetadata } from "@/lib/platform-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return platformMetadata(params, "tools");
}

export const dynamic = "force-dynamic";

import { PlatformDirectory } from "@/components/PlatformDirectory";

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  return <PlatformDirectory kind="tools" category={category} />;
}
