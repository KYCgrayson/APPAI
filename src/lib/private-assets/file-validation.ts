const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export async function validatePrivateAssetFile(file: File) {
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { valid: false as const, error: "Unsupported file type." };
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const signatureMatches =
    (file.type === "image/jpeg" && startsWith(bytes, [0xff, 0xd8, 0xff])) ||
    (file.type === "image/png" && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (file.type === "image/webp" && startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])) ||
    (file.type === "application/pdf" && startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]));

  return signatureMatches
    ? { valid: true as const }
    : { valid: false as const, error: "File content does not match its declared type." };
}

export function safePrivateAssetFilename(value: string) {
  const filename = value
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "");
  return (filename || "document").slice(-120);
}
