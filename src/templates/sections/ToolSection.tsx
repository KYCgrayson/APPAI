"use client";

import { useState, useRef, useCallback } from "react";

// --- Field type definitions ---

interface TextField {
  type: "text" | "url" | "password";
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

interface SelectField {
  type: "select";
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  default?: string;
}

interface ToggleField {
  type: "toggle";
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  default?: string;
}

interface FileField {
  type: "file";
  name: string;
  label: string;
  accept?: string; // e.g. ".pdf", "image/*", ".pdf,.docx"
  multiple?: boolean;
  maxSizeMB?: number;
}

type ToolField = TextField | SelectField | ToggleField | FileField;

// --- Result types ---

interface ToolResult {
  /** Download URL for the processed file */
  download_url?: string;
  /** Filename for the download */
  filename?: string;
  /** Preview image URL (before/after, processed result) */
  preview_url?: string;
  /** Text result to display */
  message?: string;
  /** Any additional data */
  [key: string]: unknown;
}

// --- Component props ---

interface Props {
  data: {
    heading?: string;
    description?: string;
    apiBase: string;
    apiEndpoint: string; // e.g. "/merge-pdf", "/remove-bg"
    apiToken?: string;
    fields: ToolField[];
    submitLabel?: string;
    resultType?: "download" | "preview" | "text" | "auto";
    fileSizeLimit?: string; // e.g. "50MB" — shown as hint
    expiresIn?: string; // e.g. "1 hour" — shown after result
  };
  themeColor: string;
}

type Status = "idle" | "uploading" | "processing" | "ready" | "error";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileDropZone({
  field,
  files,
  onFiles,
  themeColor,
}: {
  field: FileField;
  files: File[];
  onFiles: (files: File[]) => void;
  themeColor: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (field.multiple) {
        onFiles([...files, ...dropped]);
      } else {
        onFiles(dropped.slice(0, 1));
      }
    },
    [field.multiple, files, onFiles],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (field.multiple) {
      onFiles([...files, ...selected]);
    } else {
      onFiles(selected.slice(0, 1));
    }
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    onFiles(files.filter((_, i) => i !== index));
  };

  const maxBytes = (field.maxSizeMB || 0) * 1024 * 1024;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {field.label}
      </label>
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? "border-opacity-100 bg-opacity-5" : "border-gray-300 hover:border-gray-400"
        }`}
        style={dragOver ? { borderColor: themeColor, backgroundColor: `${themeColor}0d` } : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={field.accept}
          multiple={field.multiple}
          onChange={handleChange}
          className="hidden"
        />
        <div className="text-gray-500 text-sm">
          <p className="font-medium mb-1">
            Drop {field.multiple ? "files" : "file"} here or click to browse
          </p>
          {field.accept && (
            <p className="text-xs text-gray-400">
              Accepted: {field.accept}
            </p>
          )}
          {field.maxSizeMB && (
            <p className="text-xs text-gray-400">
              Max: {field.maxSizeMB}MB per file
            </p>
          )}
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, i) => {
            const oversize = maxBytes > 0 && file.size > maxBytes;
            return (
              <div
                key={`${file.name}-${i}`}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                  oversize
                    ? "bg-red-50 border border-red-200"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <span className="truncate block">{file.name}</span>
                  <span className="text-xs text-gray-400">
                    {formatFileSize(file.size)}
                    {oversize && (
                      <span className="text-red-500 ml-2">exceeds limit</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ToolSection({ data, themeColor }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, File[]>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState("");

  // Initialize defaults
  const fields = data.fields || [];

  const setValue = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const getVal = (name: string, defaultVal?: string) => {
    return values[name] ?? defaultVal ?? "";
  };

  const handleSubmit = async () => {
    // Pre-flight: validate file sizes
    for (const field of fields) {
      if (field.type === "file" && field.maxSizeMB) {
        const maxBytes = field.maxSizeMB * 1024 * 1024;
        for (const file of fileValues[field.name] || []) {
          if (file.size > maxBytes) {
            setError(`${file.name} exceeds the ${field.maxSizeMB}MB limit`);
            setStatus("error");
            return;
          }
        }
      }
    }

    setStatus("uploading");
    setError("");
    setResult(null);
    setProgress(0);

    const hasFiles = fields.some((f) => f.type === "file");
    const apiUrl = `${data.apiBase}${data.apiEndpoint}`;

    // Timeout: 120s for file uploads, 30s for text-only
    const controller = new AbortController();
    const timeoutMs = hasFiles ? 120_000 : 30_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let res: Response;

      if (hasFiles) {
        // multipart/form-data for file uploads
        const formData = new FormData();

        // Add text/select/toggle values
        for (const field of fields) {
          if (field.type !== "file") {
            const val = getVal(field.name, "default" in field ? field.default : undefined);
            if (val) formData.append(field.name, val);
          }
        }

        // Add files
        for (const field of fields) {
          if (field.type === "file") {
            const files = fileValues[field.name] || [];
            for (const file of files) {
              formData.append(field.name, file);
            }
          }
        }

        setStatus("processing");
        setProgress(50);

        res = await fetch(apiUrl, {
          method: "POST",
          headers: data.apiToken ? { token: data.apiToken } : {},
          body: formData,
          signal: controller.signal,
        });
      } else {
        // JSON body for text-only tools
        const body: Record<string, string> = {};
        for (const field of fields) {
          const val = getVal(field.name, "default" in field ? field.default : undefined);
          if (val) body[field.name] = val;
        }

        setStatus("processing");
        setProgress(50);

        res = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(data.apiToken ? { token: data.apiToken } : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      }

      setProgress(90);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).detail ||
            (body as Record<string, string>).error ||
            `Request failed (${res.status})`,
        );
      }

      // Check if response is a direct file download
      const contentType = res.headers.get("content-type") || "";
      if (
        contentType.includes("application/octet-stream") ||
        contentType.includes("application/pdf") ||
        contentType.includes("image/") ||
        res.headers.get("content-disposition")
      ) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const disposition = res.headers.get("content-disposition");
        const filenameMatch = disposition?.match(/filename="?([^";\n]+)"?/);
        setResult({
          download_url: url,
          filename: filenameMatch?.[1] || "download",
          preview_url: contentType.includes("image/") ? url : undefined,
        });
      } else {
        let json;
        try {
          json = await res.json();
        } catch {
          throw new Error("Server returned an invalid response");
        }
        setResult(json as ToolResult);
      }

      setProgress(100);
      setStatus("ready");
    } catch (e: unknown) {
      let message = "Something went wrong";
      if (e instanceof DOMException && e.name === "AbortError") {
        message = "Request timed out. The server took too long to respond.";
      } else if (e instanceof Error) {
        message = e.message;
      }
      setError(message);
      setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  };

  const handleDownload = () => {
    if (!result?.download_url) return;
    const link = document.createElement("a");
    link.href = result.download_url;
    link.download = result.filename || "download";
    link.click();
    // Clean up blob URL after download starts
    if (result.download_url.startsWith("blob:")) {
      setTimeout(() => URL.revokeObjectURL(result.download_url!), 5000);
    }
  };

  const resetTool = () => {
    // Clean up any blob URLs
    if (result?.download_url?.startsWith("blob:")) {
      URL.revokeObjectURL(result.download_url);
    }
    if (result?.preview_url?.startsWith("blob:")) {
      URL.revokeObjectURL(result.preview_url);
    }
    setStatus("idle");
    setResult(null);
    setError("");
    setProgress(0);
  };

  const toggleClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
      active
        ? "text-white border-transparent"
        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
    }`;

  return (
    <section className="py-12 md:py-16 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        {data.heading && (
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
            {data.heading}
          </h2>
        )}
        {data.description && (
          <p className="text-gray-500 text-sm text-center mb-8">
            {data.description}
          </p>
        )}

        <div className="space-y-5">
          {/* Dynamic fields */}
          {fields.map((field) => {
            if (field.type === "file") {
              return (
                <FileDropZone
                  key={field.name}
                  field={field}
                  files={fileValues[field.name] || []}
                  onFiles={(files) =>
                    setFileValues((prev) => ({ ...prev, [field.name]: files }))
                  }
                  themeColor={themeColor}
                />
              );
            }

            if (field.type === "toggle") {
              const currentVal = getVal(field.name, field.default);
              return (
                <div key={field.name} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {field.label}
                  </span>
                  <div className="flex gap-2">
                    {field.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setValue(field.name, opt.value)}
                        className={toggleClass(currentVal === opt.value)}
                        style={
                          currentVal === opt.value
                            ? { backgroundColor: themeColor }
                            : undefined
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            if (field.type === "select") {
              return (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {field.label}
                  </label>
                  <select
                    value={getVal(field.name, field.default)}
                    onChange={(e) => setValue(field.name, e.target.value)}
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2"
                    style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                  >
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            // text, url, password
            return (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type={field.type}
                  value={getVal(field.name)}
                  onChange={(e) => setValue(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{ "--tw-ring-color": themeColor } as React.CSSProperties}
                />
              </div>
            );
          })}

          {/* File size limit hint */}
          {data.fileSizeLimit && (
            <p className="text-xs text-gray-400 text-center">
              Max file size: {data.fileSizeLimit}
            </p>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={status === "uploading" || status === "processing"}
            className="w-full text-white px-6 py-3 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: themeColor }}
          >
            {status === "uploading"
              ? "Uploading..."
              : status === "processing"
                ? "Processing..."
                : data.submitLabel || "Process"}
          </button>

          {/* Progress bar */}
          {(status === "uploading" || status === "processing") && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: themeColor }}
              />
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
              <p className="text-sm text-red-600 mb-2">{error}</p>
              <button
                onClick={resetTool}
                className="text-sm text-red-700 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Result */}
          {status === "ready" && result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
              {/* Text message */}
              {result.message && (
                <p className="text-sm text-green-800 text-center">
                  {result.message}
                </p>
              )}

              {/* Image preview */}
              {result.preview_url && (
                <div className="flex justify-center">
                  <img
                    src={result.preview_url}
                    alt="Result preview"
                    className="max-h-64 rounded-lg border border-green-200"
                  />
                </div>
              )}

              {/* Download button */}
              {result.download_url && (
                <div className="text-center">
                  <button
                    onClick={handleDownload}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    {result.filename
                      ? `Save: ${result.filename}`
                      : "Save File"}
                  </button>
                </div>
              )}

              {/* Expiry notice */}
              {data.expiresIn && (
                <p className="text-xs text-gray-400 text-center">
                  File available for {data.expiresIn}
                </p>
              )}

              {/* Process another */}
              <div className="text-center">
                <button
                  onClick={resetTool}
                  className="text-sm underline hover:no-underline"
                  style={{ color: themeColor }}
                >
                  Process another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
