import { createHash } from "crypto";
import { db } from "./db";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function validateApiKey(authHeader: string | null) {
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

  // Update last used
  await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    organizationId: apiKey.organizationId,
    organization: apiKey.organization,
  };
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const { randomBytes } = require("crypto");
  const raw = randomBytes(32).toString("hex");
  const key = `aiga_sk_${raw}`;
  const hash = hashApiKey(key);
  const prefix = `aiga_sk_${raw.slice(0, 8)}...`;
  return { key, hash, prefix };
}
