export function getPrivateBlobAuth(
  env: Record<string, string | undefined> = process.env,
) {
  const token = env.PRIVATE_BLOB_READ_WRITE_TOKEN;
  const usesVercelOidc = Boolean(env.VERCEL && env.BLOB_STORE_ID);

  return {
    configured: Boolean(token || usesVercelOidc),
    mode: token ? "static-token" as const : usesVercelOidc ? "oidc" as const : "missing" as const,
    options: token ? { token } : {},
  };
}
