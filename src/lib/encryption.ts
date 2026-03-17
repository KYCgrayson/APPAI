import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 256-bit encryption key from the configured secret.
 * Prefers DEVICE_AUTH_ENCRYPTION_KEY; falls back to NEXTAUTH_SECRET.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.DEVICE_AUTH_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Missing encryption key: set DEVICE_AUTH_ENCRYPTION_KEY or NEXTAUTH_SECRET"
    );
  }
  // Deterministically derive a 32-byte key from the secret
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64-encoded payload: iv (12 B) + authTag (16 B) + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: iv + authTag + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypt a base64-encoded AES-256-GCM payload produced by `encrypt`.
 */
export function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const packed = Buffer.from(encoded, "base64");

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
