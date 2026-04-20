const APPAI_HOSTS = new Set(["appai.info", "www.appai.info"]);

export type ExternalCanonical = {
  host: string;
  url: string;
};

export function getExternalCanonical(
  canonicalUrl: string | null | undefined,
): ExternalCanonical | null {
  if (!canonicalUrl) return null;
  try {
    const parsed = new URL(canonicalUrl);
    if (APPAI_HOSTS.has(parsed.host)) return null;
    return { host: parsed.host.replace(/^www\./, ""), url: canonicalUrl };
  } catch {
    return null;
  }
}
