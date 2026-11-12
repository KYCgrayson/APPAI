import { createHash, randomBytes } from "crypto";
import { db } from "./db";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function validateApiKey(authHeader: string | null, options: { readOnly?: boolean } = {}) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const key = authHeader.slice(7);
  const keyHash = hashApiKey(key);

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash, isActive: true },
    include: { organization: true },
  });

  if (!apiKey) return null;

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Dry-runs must not write, including key usage metadata.
  if (!options.readOnly) await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    apiKeyId: apiKey.id,
    organizationId: apiKey.organizationId,
    organization: apiKey.organization,
  };
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const key = `appai_sk_${raw}`;
  const hash = hashApiKey(key);
  const prefix = `appai_sk_${raw.slice(0, 8)}...`;
  return { key, hash, prefix };
}
