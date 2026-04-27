import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https:",
      // frame-src: allows two classes of embeds —
      //   (1) common public hosting platforms used by tools registered via
      //       the `iframe-tool` section (agents push their own deployments)
      //   (2) media/embed providers used by the `embed` section
      // frame-ancestors stays 'none' — that's who can embed US, unrelated.
      [
        "frame-src 'self'",
        // Public hosting platforms (agent-deployed tools)
        "https://*.vercel.app",
        "https://*.netlify.app",
        "https://*.pages.dev",
        "https://*.github.io",
        "https://*.web.app",
        "https://*.firebaseapp.com",
        "https://*.fly.dev",
        "https://*.onrender.com",
        "https://*.workers.dev",
        "https://*.deno.dev",
        "https://*.replit.app",
        "https://*.repl.co",
        "https://*.hf.space",
        "https://*.gradio.live",
        "https://*.streamlit.app",
        "https://*.modal.run",
        "https://*.railway.app",
        "https://*.up.railway.app",
        "https://*.glitch.me",
        "https://*.surge.sh",
        // Media / embed providers
        "https://www.youtube.com",
        "https://www.youtube-nocookie.com",
        "https://player.vimeo.com",
        "https://www.tiktok.com",
        "https://www.loom.com",
        "https://open.spotify.com",
        "https://codepen.io",
        "https://www.figma.com",
      ].join(" "),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ") + ";",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
