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
