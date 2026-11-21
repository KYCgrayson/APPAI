import { launchUniversalApp } from "@/lib/universal-apps/launcher";
import { getUniversalAppNestedReturnPath } from "@/lib/universal-apps/launcher-path";

export default async function UniversalAppNestedLauncher({
  params,
}: {
  params: Promise<{ appId: string; path: string[] }>;
}) {
  const { appId, path } = await params;
  return launchUniversalApp(appId, getUniversalAppNestedReturnPath(appId, path));
}
