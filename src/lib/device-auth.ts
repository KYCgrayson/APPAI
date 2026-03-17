import { randomBytes } from "crypto";

// RFC 8628: Use consonants only to avoid forming offensive words
// Also excludes visually ambiguous characters
const USER_CODE_CHARS = "BCDFGHJKLMNPQRSTVWXZ";

/**
 * Generate a high-entropy device code (256-bit).
 * This is the long code used by the CLI to poll — never shown to the user.
 */
export function generateDeviceCode(): string {
  return randomBytes(32).toString("hex"); // 64 hex chars
}

/**
 * Generate a short user code in "XXXX-XXXX" format (RFC 8628 §6.1).
 * Uses 20 consonant characters → 20^8 ≈ 25.6 billion combinations (~34.5 bits entropy).
 */
export function generateUserCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += USER_CODE_CHARS[bytes[i] % USER_CODE_CHARS.length];
  }
  return code;
}

/**
 * Normalize user code input: uppercase, strip dashes/spaces.
 * Makes comparison resilient to formatting differences.
 */
export function normalizeUserCode(input: string): string {
  return input.toUpperCase().replace(/[-\s]/g, "");
}
