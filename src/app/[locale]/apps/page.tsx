export const dynamic = "force-dynamic";

import { PlatformDirectory } from "@/components/PlatformDirectory";
import { DIRECTORY_KINDS } from "@/lib/directory-kind";

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; kind?: string }>;
}) {
  const { category, kind: requestedKind } = await searchParams;
  const kind = DIRECTORY_KINDS.includes(requestedKind as (typeof DIRECTORY_KINDS)[number])
    ? (requestedKind as (typeof DIRECTORY_KINDS)[number])
    : undefined;
  return <PlatformDirectory kind={kind} category={category} />;
}
