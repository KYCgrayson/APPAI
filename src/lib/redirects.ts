export function safeInternalPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;

  try {
    const url = new URL(value, "https://appai.info");
    const decodedPath = decodeURIComponent(url.pathname);
    if (decodedPath.startsWith("//") || decodedPath.includes("\\")) return fallback;
    return url.origin === "https://appai.info"
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
