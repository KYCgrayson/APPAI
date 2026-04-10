"use client";

import { useState } from "react";

type FieldType = "text" | "email" | "tel" | "textarea" | "select";

interface FormField {
  type: FieldType;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string; description?: string }>;
}

interface Props {
  data: {
    heading?: string;
    description?: string;
    fields: FormField[];
    /**
     * Either "mailto:user@example.com" or an https:// URL (treated as a
     * webhook). Handled server-side by POST /api/v1/form-submit — the
     * browser never sees the target.
     */
    submitTo?: string;
    submitLabel?: string;
    successMessage?: string;
  };
  themeColor: string;
  /** Route context so the server can look up the section config. */
  pageSlug: string;
  parentSlug?: string | null;
  locale: string;
  sectionOrder?: number;
}

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function FormSection({
  data,
  themeColor,
  pageSlug,
  parentSlug,
  locale,
  sectionOrder,
}: Props) {
  const fields = data.fields || [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<State>({ kind: "idle" });

  function setField(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Client-side required check
    for (const f of fields) {
      if (f.required && !(values[f.name] ?? "").trim()) {
        setState({ kind: "error", message: `${f.label} is required.` });
        return;
      }
    }
    setState({ kind: "submitting" });

    const submitTo = data.submitTo || "";

    if (submitTo.startsWith("mailto:")) {
      // Client-side mailto: compose the email body from form fields, then
      // trigger the user's own device mail client. No server round-trip.
      const to = submitTo.slice("mailto:".length);
      const subject = encodeURIComponent(
        data.heading ? `[${data.heading}] Form submission` : "Form submission",
      );
      const bodyLines: string[] = [];
      for (const f of fields) {
        bodyLines.push(`${f.label}: ${values[f.name] ?? ""}`);
      }
      const body = encodeURIComponent(bodyLines.join("\n"));
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
      setState({ kind: "success" });
      return;
    }

    // Webhook path: POST to our server which proxies to the agent's URL.
    try {
      const res = await fetch("/api/v1/form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageSlug,
          parentSlug: parentSlug ?? null,
          locale,
          sectionOrder,
          fields: values,
        }),
      });
      if (!res.ok) {
        const respBody = (await res.json().catch(() => ({}))) as { error?: string };
        setState({
          kind: "error",
          message: respBody.error || `Submission failed (HTTP ${res.status}).`,
        });
        return;
      }
      setState({ kind: "success" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error.";
      setState({ kind: "error", message });
    }
  }

  if (state.kind === "success") {
    return (
      <section className="py-12 md:py-20 px-4 sm:px-6">
        <div className="max-w-xl mx-auto text-center">
          {data.heading && (
            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6"
              style={{ color: themeColor }}
            >
              {data.heading}
            </h2>
          )}
          <div className="rounded-2xl border-2 p-8" style={{ borderColor: themeColor }}>
            <p className="text-lg font-medium text-gray-900">
              {data.successMessage || "Thanks — your message has been sent."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        {data.heading && (
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-4"
            style={{ color: themeColor }}
          >
            {data.heading}
          </h2>
        )}
        {data.description && (
          <p className="text-center text-gray-600 mb-8 md:mb-10">{data.description}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl shadow-sm p-6 md:p-8 border border-gray-100">
          {fields.map((f) => {
            const id = `form-${pageSlug}-${sectionOrder ?? "0"}-${f.name}`;
            const common = {
              id,
              name: f.name,
              required: f.required,
              placeholder: f.placeholder,
              value: values[f.name] ?? "",
              className:
                "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-gray-900",
              style: { ["--tw-ring-color" as string]: themeColor } as React.CSSProperties,
            };
            return (
              <div key={f.name}>
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
                  {f.label}
                  {f.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    {...common}
                    rows={5}
                    onChange={(e) => setField(f.name, e.target.value)}
                  />
                ) : f.type === "select" ? (
                  <select
                    {...common}
                    onChange={(e) => setField(f.name, e.target.value)}
                  >
                    <option value="">{f.placeholder || "Select..."}</option>
                    {(f.options || []).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...common}
                    type={f.type}
                    onChange={(e) => setField(f.name, e.target.value)}
                  />
                )}
                {f.type === "select" && values[f.name] && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    {(f.options || []).find((o) => o.value === values[f.name])?.description}
                  </p>
                )}
              </div>
            );
          })}

          {state.kind === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.message}
            </div>
          )}

          <button
            type="submit"
            disabled={state.kind === "submitting"}
            className="w-full px-8 py-4 rounded-full text-white font-semibold text-lg transition-transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ backgroundColor: themeColor }}
          >
            {state.kind === "submitting" ? "Sending…" : data.submitLabel || "Submit"}
          </button>
        </form>
      </div>
    </section>
  );
}
