export function getVercelOidcToken(headers: Headers, fallbackToken = process.env.VERCEL_OIDC_TOKEN) {
  return headers.get("x-vercel-oidc-token") || fallbackToken;
}
