import { headers } from "next/headers";

import { safeInternalPath } from "@/lib/redirects";
import { launchUniversalApp } from "@/lib/universal-apps/launcher";

export default async function UniversalAppLauncher({ params }: { params: Promise<{ appId: string }> }) {
  const appId = (await params).appId;
  const requestHeaders = await headers();
  return launchUniversalApp(appId, safeInternalPath(requestHeaders.get("x-appai-request-path"), `/app/${appId}`));
}
