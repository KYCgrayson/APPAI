"use client";

import { useState } from "react";
import {
  sanitizeUrl,
  sanitizeActionHeaders,
  isActionUrlSafe,
  extractDomain,
} from "@/lib/sanitize";
import { Prose } from "@/templates/shared/Prose";

interface ActionItem {
  label: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  confirmText?: string;
  style?: "primary" | "secondary" | "danger";
}

interface Props {
  data: {
    subheading?: string;
    heading?: string;
    description?: string;
    items: ActionItem[];
  };
  themeColor: string;
  darkMode?: boolean;
}

function ActionButton({ item, themeColor }: { item: ActionItem; themeColor: string }) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<string>("");

  const safeUrl = sanitizeUrl(item.url);
  const urlSafe = isActionUrlSafe(item.url);
  const domain = extractDomain(item.url);
  const safeHeaders = sanitizeActionHeaders(item.headers);

  async function handleClick() {
    if (!urlSafe) {
      setState("error");
      setResult("This action URL has been blocked for security reasons.");
      return;
    }

    const confirmMessage =
      item.confirmText ||
      `This action will send a ${item.method || "POST"} request to ${domain}. Continue?`;
    if (!window.confirm(confirmMessage)) return;

    setState("loading");
    setResult("");

    try {
      const res = await fetch(safeUrl, {
        method: item.method || "POST",
        headers: {
          "Content-Type": "application/json",
          ...safeHeaders,
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      const text = await res.text();
      let display: string;
      try {
        display = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        display = text;
      }

      setState(res.ok ? "success" : "error");
      setResult(`${res.status} ${res.statusText}\n${display}`);
    } catch (err) {
      setState("error");
      setResult(err instanceof Error ? err.message : "Request failed");
    }
  }

  const baseClass = "px-6 py-3 rounded-lg font-medium transition-colors text-sm";
  const styleMap = {
    primary: { backgroundColor: themeColor, color: "#fff" },
    secondary: { border: `2px solid ${themeColor}`, color: themeColor },
    danger: { backgroundColor: "#dc2626", color: "#fff" },
  };
  const buttonStyle = styleMap[item.style || "primary"];

  return (
    <div className="flex flex-col gap-2">
      {/* Security warning banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <span>&#9888;</span>
        <span>
          This button will send a {item.method || "POST"} request to{" "}
          <strong>{domain}</strong>
        </span>
        {!urlSafe && (
          <span className="ml-auto text-red-600 font-semibold">BLOCKED</span>
        )}
      </div>
      <button
        onClick={handleClick}
        disabled={state === "loading" || !urlSafe}
        className={`${baseClass} ${
          state === "loading" || !urlSafe
            ? "opacity-50 cursor-not-allowed"
            : "hover:opacity-80"
        }`}
        style={buttonStyle}
      >
        {!urlSafe
          ? "Action Blocked"
          : state === "loading"
            ? "Executing..."
            : item.label}
      </button>
      {result && (
        <pre
          className={`text-xs p-3 rounded-lg overflow-x-auto max-h-48 whitespace-pre-wrap break-words ${
            state === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {result}
        </pre>
      )}
    </div>
  );
}

export function ActionSection({ data, themeColor, darkMode, typographyActive = false }: Props & { typographyActive?: boolean }) {
  const items = data.items || [];

  return (
    <section className="py-12 md:py-16 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {data.heading && (
          <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-2xl md:text-3xl font-bold text-center mb-2">{data.heading}</h2>
        )}
        {data.subheading && <p className="text-center mb-6">{data.subheading}</p>}
        {data.description && (
          <Prose typographyRole={typographyActive ? "body" : undefined} className={`prose prose-sm md:prose-base max-w-none text-center mb-8 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{data.description}</Prose>
        )}
        <div className="flex flex-col gap-4">
          {items.map((item, i) => (
            <ActionButton key={i} item={item} themeColor={themeColor} />
          ))}
        </div>
      </div>
    </section>
  );
}
