/**
 * Connector registry — code-defined backends that tool sections may call
 * through the generic proxy at /api/connect/{name}/{...path}.
 *
 * Connectors are intentionally NOT agent-writable: they reference server
 * secrets and target hosts, which must stay owner-controlled (an agent must
 * not be able to point a server-authenticated proxy at an arbitrary host).
 * Agents reference a connector by name from a tool section; the owner adds a
 * new connector here (one entry) when wiring a genuinely new backend.
 *
 * See docs/interactive-tools-architecture.md.
 */

export type ConnectorAuth = "none" | "server-token" | "user-session";
export type GatingMode = "public" | "login";

export interface Connector {
  /** Path segment: /api/connect/{name}/... */
  name: string;
  /** Env var holding the backend base URL (e.g. https://subtitle.myaiapp.uk). */
  baseUrlEnv: string;
  /** Path prefix appended to baseUrl before the proxied sub-path (e.g. "/v1"). */
  basePath?: string;
  auth: ConnectorAuth;
  /** Env var holding the bearer token, when auth === "server-token". */
  secretEnv?: string;
  /** Forward X-AppAI-User / X-AppAI-Admin identity headers to the backend. */
  forwardIdentity?: boolean;
  /** Whitelist of allowed proxied sub-paths (defense in depth). */
  allowPaths: RegExp;
  /** Whether anonymous callers may use this connector. */
  gating: GatingMode;
  /** Optional per-caller quota, enforced by the generic proxy. */
  quota?: { per: "user" | "ip"; limit: number; window: "24h" | "1h" };
  /**
   * Maps a proxied request to a usage `action` label (for UsageEvent), or
   * null to not record. Keeps usage semantics with the connector.
   */
  usageAction?: (method: string, path: string, body: unknown) => string | null;
}

const CONNECTORS: Record<string, Connector> = {
  "video-subtitle": {
    name: "video-subtitle",
    baseUrlEnv: "SUBTITLE_BACKEND_URL",
    basePath: "/v1",
    auth: "server-token",
    secretEnv: "SUBTITLE_BACKEND_TOKEN",
    forwardIdentity: true,
    allowPaths: /^jobs(\/[A-Za-z0-9-]+)?(\/file)?$/,
    gating: "login",
    quota: { per: "user", limit: 1, window: "24h" },
    usageAction: (method, path, body) => {
      if (method === "POST" && path === "jobs") {
        const kind = (body as { kind?: string } | null)?.kind ?? "job";
        return `job.${kind}`;
      }
      return null; // don't log polls / downloads / cancels
    },
  },
};

export function getConnector(name: string): Connector | null {
  return CONNECTORS[name] ?? null;
}

export function connectorBaseUrl(c: Connector): string | null {
  const base = process.env[c.baseUrlEnv];
  if (!base) return null;
  return base.replace(/\/$/, "") + (c.basePath ?? "");
}
