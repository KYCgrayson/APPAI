#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://appai.info";

const server = new McpServer({
  name: "appai",
  version: "1.0.0",
});

// Helper to make API requests
async function apiRequest(
  path: string,
  options: {
    method?: string;
    apiKey?: string;
    body?: unknown;
    query?: Record<string, string>;
  } = {}
): Promise<unknown> {
  const { method = "GET", apiKey, body, query } = options;
  const url = new URL(path, API_BASE);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, body: text };
  }
}

// --- Resources ---

server.resource("agent-spec", "appai://spec", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      mimeType: "text/plain",
      text: await fetch(`${API_BASE}/spec`).then((r) => r.text()),
    },
  ],
}));

server.resource("llms-info", "appai://llms.txt", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      mimeType: "text/plain",
      text: await fetch(`${API_BASE}/llms.txt`).then((r) => r.text()),
    },
  ],
}));

// --- Tools ---

server.tool(
  "start-auth",
  "Start device authorization flow to get an AppAI API key. Returns a verification URL the user must open in their browser to sign in with Google.",
  {},
  async () => {
    const result = await apiRequest("/api/v1/auth/device", { method: "POST" });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "poll-auth",
  "Poll for authentication completion after start-auth. Returns the API key when the user has authorized.",
  {
    device_code: z.string().describe("The device_code from start-auth response"),
  },
  async ({ device_code }) => {
    const result = await apiRequest("/api/v1/auth/token", {
      method: "POST",
      body: { device_code },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "list-presets",
  "List available page preset templates (app landing, SaaS, profile, link-in-bio, portfolio, event). Each preset includes recommended sections and a live preview URL.",
  {},
  async () => {
    const result = await apiRequest("/api/v1/presets");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "list-sections",
  "List all available section types that can be used when building a page (hero, features, pricing, FAQ, etc.) with their data schemas.",
  {},
  async () => {
    const result = await apiRequest("/api/v1/sections");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "create-page",
  "Create a new hosted page on AppAI. Includes landing page, privacy policy, and terms of service. The page is instantly live at appai.info/p/{slug}.",
  {
    api_key: z.string().describe("AppAI API key (appai_sk_...)"),
    slug: z.string().describe("URL-safe identifier (lowercase, hyphens only, e.g. 'my-cool-app')"),
    title: z.string().describe("Page title"),
    locale: z.string().optional().describe("BCP 47 locale code (default: 'en')"),
    tagline: z.string().optional().describe("Short description"),
    themeColor: z.string().optional().describe("Hex color (e.g. '#6366F1')"),
    content: z.object({
      sections: z.array(z.object({
        type: z.string(),
        order: z.number(),
        data: z.record(z.string(), z.unknown()),
      })),
    }).describe("Page content with sections array"),
    privacyPolicy: z.string().optional().describe("Markdown text for privacy policy"),
    termsOfService: z.string().optional().describe("Markdown text for terms of service"),
    isPublished: z.boolean().optional().describe("Set true to publish immediately"),
    category: z.string().optional().describe("App category: WRITING, CODING, DESIGN, AUTOMATION, PRODUCTIVITY, SOCIAL, FINANCE, HEALTH, EDUCATION, OTHER"),
    upsert: z.boolean().optional().describe("If true, overwrites existing page with same slug"),
  },
  async ({ api_key, slug, upsert, ...rest }) => {
    const query: Record<string, string> = {};
    if (upsert) query.upsert = "true";
    const result = await apiRequest("/api/v1/pages", {
      method: "POST",
      apiKey: api_key,
      body: { slug, ...rest },
      query,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "list-pages",
  "List all pages owned by the authenticated user.",
  {
    api_key: z.string().describe("AppAI API key"),
  },
  async ({ api_key }) => {
    const result = await apiRequest("/api/v1/pages", { apiKey: api_key });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get-page",
  "Get details of a specific page by slug.",
  {
    api_key: z.string().describe("AppAI API key"),
    slug: z.string().describe("Page slug"),
    locale: z.string().optional().describe("Locale code to get a specific language version"),
    variants: z.boolean().optional().describe("If true, list all locale variants"),
  },
  async ({ api_key, slug, locale, variants }) => {
    const query: Record<string, string> = {};
    if (locale) query.locale = locale;
    if (variants) query.variants = "true";
    const result = await apiRequest(`/api/v1/pages/${slug}`, {
      apiKey: api_key,
      query,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "update-page",
  "Update an existing page (PATCH for partial update with deep merge, PUT for full replace).",
  {
    api_key: z.string().describe("AppAI API key"),
    slug: z.string().describe("Page slug"),
    method: z.enum(["PATCH", "PUT"]).optional().describe("PATCH for partial update (default), PUT for full replace"),
    locale: z.string().optional().describe("Locale code to update a specific language version"),
    title: z.string().optional(),
    tagline: z.string().optional(),
    themeColor: z.string().optional(),
    content: z.object({
      sections: z.array(z.object({
        type: z.string(),
        order: z.number(),
        data: z.record(z.string(), z.unknown()),
      })),
    }).optional(),
    privacyPolicy: z.string().optional(),
    termsOfService: z.string().optional(),
    isPublished: z.boolean().optional(),
  },
  async ({ api_key, slug, method = "PATCH", locale, ...rest }) => {
    const query: Record<string, string> = {};
    if (locale) query.locale = locale;
    // Remove undefined fields
    const body = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined)
    );
    const result = await apiRequest(`/api/v1/pages/${slug}`, {
      method,
      apiKey: api_key,
      body,
      query,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "delete-page",
  "Delete a page by slug. Optionally delete only a specific locale variant.",
  {
    api_key: z.string().describe("AppAI API key"),
    slug: z.string().describe("Page slug"),
    locale: z.string().optional().describe("Delete only this locale variant"),
  },
  async ({ api_key, slug, locale }) => {
    const query: Record<string, string> = {};
    if (locale) query.locale = locale;
    const result = await apiRequest(`/api/v1/pages/${slug}`, {
      method: "DELETE",
      apiKey: api_key,
      query,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "set-default-locale",
  "Change the default locale for a page.",
  {
    api_key: z.string().describe("AppAI API key"),
    slug: z.string().describe("Page slug"),
    locale: z.string().describe("Locale to set as default"),
  },
  async ({ api_key, slug, locale }) => {
    const result = await apiRequest(`/api/v1/pages/${slug}/set-default`, {
      method: "POST",
      apiKey: api_key,
      query: { locale },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// --- Prompts ---

server.prompt(
  "create-app-page",
  { app_name: z.string().optional().describe("Name of the app") },
  ({ app_name }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Help me create a landing page${app_name ? ` for "${app_name}"` : ""} on AppAI (appai.info). I need a hosted page with a privacy policy and terms of service.

Steps:
1. First, use the start-auth tool to begin authentication, then open the verification URL for me
2. Poll with poll-auth until I've signed in
3. Use list-presets to show me the available templates
4. Ask me about my app details
5. Use create-page to create the page

The page will be live at appai.info/p/{slug} with privacy policy at /privacy and terms at /terms.`,
        },
      },
    ],
  })
);

server.prompt(
  "setup-privacy-policy",
  { app_name: z.string().optional().describe("Name of the app") },
  ({ app_name }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `I need a privacy policy URL for my app${app_name ? ` "${app_name}"` : ""} to submit to the App Store / Google Play.

Use AppAI to set this up for me:
1. Authenticate with start-auth + poll-auth
2. Create a minimal page with create-page that includes a privacy policy and terms of service
3. The privacy policy URL will be appai.info/p/{slug}/privacy

This should take about 30 seconds. Please handle everything.`,
        },
      },
    ],
  })
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
