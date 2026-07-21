import { universalAppIdSchema } from "./manifest.ts";

/** Builds a canonical internal return path for a generic Universal App route. */
export function getUniversalAppNestedReturnPath(appId: string, path: readonly string[]) {
  const normalizedAppId = universalAppIdSchema.parse(appId);
  return `/app/${normalizedAppId}/${path.map(encodeURIComponent).join("/")}`;
}

const PLATFORM_ORIGIN = "https://appai.info";

function safeRuntimeEntryPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";

  try {
    const target = new URL(value, PLATFORM_ORIGIN);
    const decodedPath = decodeURIComponent(target.pathname);
    if (target.origin !== PLATFORM_ORIGIN || decodedPath.startsWith("//") || decodedPath.includes("\\")) return "/";
    return target.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "/";
  }
}

/**
 * Maps an AppAI route to the route inside an isolated managed runtime.
 *
 * The input route is always constrained to this app's `/app/{id}` prefix.
 * A malformed or cross-app route deliberately falls back to the manifest's
 * entry path instead of becoming an external redirect target.
 */
export function mapPlatformRouteToRuntimePath(appId: string, platformPath: string | undefined, entryPath: string) {
  const normalizedAppId = universalAppIdSchema.parse(appId);
  const runtimeEntryPath = safeRuntimeEntryPath(entryPath);
  const platformBasePath = `/app/${normalizedAppId}`;

  if (!platformPath || !platformPath.startsWith("/") || platformPath.startsWith("//") || platformPath.includes("\\")) {
    return runtimeEntryPath;
  }

  try {
    const target = new URL(platformPath, PLATFORM_ORIGIN);
    const decodedPath = decodeURIComponent(target.pathname);
    if (target.origin !== PLATFORM_ORIGIN || decodedPath.startsWith("//") || decodedPath.includes("\\")) return runtimeEntryPath;
    if (target.pathname !== platformBasePath && !target.pathname.startsWith(`${platformBasePath}/`)) return runtimeEntryPath;

    const suffix = target.pathname.slice(platformBasePath.length).replace(/^\/+/, "");
    const runtimePath = suffix
      ? `${runtimeEntryPath === "/" ? "" : runtimeEntryPath}/${suffix}`
      : runtimeEntryPath;
    return `${runtimePath}${target.search}${target.hash}`;
  } catch {
    return runtimeEntryPath;
  }
}
