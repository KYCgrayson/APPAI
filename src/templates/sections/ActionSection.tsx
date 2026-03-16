"use client";

import { useState } from "react";

interface ActionItem {
  label: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  confirmText?: string;
  style?: "primary" | "secondary" | "danger";
}

interface Props {
  data: {
    heading?: string;
    description?: string;
    items: ActionItem[];
  };
  themeColor: string;
}

function ActionButton({ item, themeColor }: { item: ActionItem; themeColor: string }) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<string>("");

  async function handleClick() {
    if (item.confirmText && !window.confirm(item.confirmText)) return;

    setState("loading");
    setResult("");

    try {
      const res = await fetch(item.url, {
        method: item.method || "POST",
        headers: {
          "Content-Type": "application/json",
          ...item.headers,
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
    } catch (err: any) {
      setState("error");
      setResult(err.message);
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
      <button
        onClick={handleClick}
        disabled={state === "loading"}
        className={`${baseClass} ${state === "loading" ? "opacity-50 cursor-wait" : "hover:opacity-80"}`}
        style={buttonStyle}
      >
        {state === "loading" ? "Executing..." : item.label}
      </button>
      {result && (
        <pre
          className={`text-xs p-3 rounded-lg overflow-auto max-h-48 ${
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

export function ActionSection({ data, themeColor }: Props) {
  const items = data.items || [];

  return (
    <section className="py-16 px-4">
      <div className="max-w-2xl mx-auto">
        {data.heading && (
          <h2 className="text-2xl font-bold text-center mb-2">{data.heading}</h2>
        )}
        {data.description && (
          <p className="text-gray-600 text-center mb-8">{data.description}</p>
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
