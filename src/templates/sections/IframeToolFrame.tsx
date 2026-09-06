"use client";

import { useRef, type ReactNode } from "react";

import { useIframeToolSession, type IframeToolIdentity } from "./use-iframe-tool-session";

/**
 * The chrome-less fullscreen view of an `iframe-tool` section
 * (`/p/{slug}/tools/{order}`).
 *
 * It exists as a client component for one reason: a tool's identity has to be
 * renewed for as long as the frame is open, and that is the same job here as it
 * is inline. The URL — including the first `appai_session` — is built on the
 * server; this only keeps it alive.
 */
export function IframeToolFrame({
  src,
  trustedOrigin,
  title,
  allowFullscreen,
  darkMode,
  identity,
  children,
}: {
  src: string;
  trustedOrigin: string;
  title: string;
  allowFullscreen?: boolean;
  darkMode: boolean;
  identity: IframeToolIdentity | null;
  children?: ReactNode;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useIframeToolSession(iframeRef, trustedOrigin, identity);

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: darkMode ? "#000" : "#fff" }}>
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        loading="eager"
        allow={allowFullscreen === false ? undefined : "fullscreen; clipboard-write; gamepad; accelerometer; gyroscope"}
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
      {children}
    </div>
  );
}
