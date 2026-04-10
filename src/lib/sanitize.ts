/**
 * Security sanitization utilities for user-supplied content.
 *
 * These functions protect against XSS and content injection attacks
 * when AI agents supply content via the pages API.
 */

const ALLOWED_URL_PROTOCOLS = /^(https?:\/\/|mailto:|tel:|#)/i;

/**
 * Validates a URL string and returns it only if it uses a safe protocol.
 * Blocks javascript:, data:, vbscript:, and any other dangerous schemes.
 * Returns "#" for any disallowed URL.
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== "string") return "#";

  const trimmed = url.trim();
  if (trimmed === "") return "#";

  if (ALLOWED_URL_PROTOCOLS.test(trimmed)) {
    return trimmed;
  }

  // Allow protocol-relative URLs (//example.com)
  if (trimmed.startsWith("//")) {
    return trimmed;
  }

  // Allow relative paths that start with /
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return "#";
}

// Keys that indicate a URL field in content JSON
const URL_KEY_PATTERNS =
  /url|Url|URL|src|href|image|logo|photo|avatar|background|ogImage|heroImage/i;

/**
 * Strips HTML tags from a string.
 */
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

/**
 * Checks whether a content key name represents a URL field.
 */
function isUrlKey(key: string): boolean {
  return URL_KEY_PATTERNS.test(key);
}

export interface SanitizeWarning {
  path: string;
  message: string;
  original?: string;
  sanitized?: string;
}

/**
 * Recursively walks a content JSON object and sanitizes all values:
 * - String values have HTML tags stripped
 * - URL fields (detected by key name) are validated to use safe protocols
 *
 * When `warnings` is provided, each mutation is recorded instead of being
 * silently applied. The returned value is still sanitized — warnings are
 * informational only, not blocking.
 */
export function sanitizeContent(
  obj: unknown,
  parentKey?: string,
  warnings?: SanitizeWarning[],
  pathPrefix?: string,
): unknown {
  if (obj === null || obj === undefined) return obj;
  const path = pathPrefix || "";

  if (typeof obj === "string") {
    let result = obj;
    const stripped = stripHtmlTags(obj);
    if (stripped !== obj && warnings) {
      warnings.push({
        path: path || parentKey || "unknown",
        message: "HTML tags were stripped from this field.",
        original: obj.slice(0, 200),
        sanitized: stripped.slice(0, 200),
      });
    }
    result = stripped;
    if (parentKey && isUrlKey(parentKey)) {
      const safe = sanitizeUrl(stripped);
      if (safe !== stripped && warnings) {
        warnings.push({
          path: path || parentKey || "unknown",
          message: "URL was sanitized because it uses a disallowed protocol.",
          original: stripped.slice(0, 200),
          sanitized: safe,
        });
      }
      return safe;
    }
    return result;
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, i) =>
      sanitizeContent(item, parentKey, warnings, `${path}[${i}]`),
    );
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = sanitizeContent(value, key, warnings, path ? `${path}.${key}` : key);
    }
    return result;
  }

  return obj;
}

// Headers that must never be forwarded in ActionSection requests
const FORBIDDEN_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "proxy-authorization",
];

/**
 * Strips sensitive headers from a user-defined headers object.
 */
export function sanitizeActionHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> {
  if (!headers || typeof headers !== "object") return {};

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!FORBIDDEN_HEADERS.includes(key.toLowerCase())) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Validates that an action URL is external and not targeting internal APIs.
 * Returns true if the URL is safe to use, false otherwise.
 */
export function isActionUrlSafe(url: string): boolean {
  if (typeof url !== "string") return false;

  const trimmed = url.trim();

  // Must be an absolute URL with http/https
  if (!/^https?:\/\//i.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    // Block requests to internal API paths
    if (parsed.pathname.startsWith("/api/") || parsed.pathname.startsWith("/api")) {
      // Check if it's pointing to the same origin
      if (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "0.0.0.0" ||
        parsed.hostname === "::1" ||
        parsed.hostname.endsWith(".local")
      ) {
        return false;
      }
    }

    // Block internal/private IP ranges
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "0.0.0.0" ||
      parsed.hostname === "::1" ||
      parsed.hostname.startsWith("10.") ||
      parsed.hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname) ||
      parsed.hostname.endsWith(".internal") ||
      parsed.hostname.endsWith(".local")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts the domain from a URL for display purposes.
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "unknown";
  }
}
