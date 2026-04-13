"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  data: {
    heading?: string;
    description?: string;
  };
  themeColor: string;
}

type Status = "idle" | "loading" | "viewing" | "error";

// Dynamically load pdfjs-dist to avoid bundling it on every page
async function loadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

export function PdfViewerSection({ data, themeColor }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Render a page to canvas
  const renderPage = useCallback(
    async (doc: any, pageNum: number) => {
      if (!canvasRef.current || !doc) return;
      try {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        console.error("Failed to render page:", e);
      }
    },
    [scale],
  );

  // Re-render when page or scale changes
  useEffect(() => {
    if (pdfDoc && currentPage > 0) {
      renderPage(pdfDoc, currentPage);
    }
  }, [pdfDoc, currentPage, scale, renderPage]);

  const openPdf = async (fileData: ArrayBuffer, pwd?: string) => {
    setStatus("loading");
    setError("");

    try {
      const pdfjsLib = await loadPdfjs();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(fileData),
        password: pwd || undefined,
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      setNeedsPassword(false);
      setStatus("viewing");
    } catch (e: any) {
      if (e?.name === "PasswordException") {
        if (e.code === 1) {
          // Needs password
          setNeedsPassword(true);
          setStatus("idle");
          setError("");
        } else if (e.code === 2) {
          // Wrong password
          setError("Incorrect password. Please try again.");
          setStatus("idle");
        }
      } else {
        setError(e?.message || "Failed to open PDF");
        setStatus("error");
      }
    }
  };

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file");
      return;
    }
    setFile(selectedFile);
    setNeedsPassword(false);
    setPassword("");
    setPdfDoc(null);

    const buffer = await selectedFile.arrayBuffer();
    await openPdf(buffer);
  };

  const handlePasswordSubmit = async () => {
    if (!file || !password) return;
    const buffer = await file.arrayBuffer();
    await openPdf(buffer, password);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleSaveUnlocked = async () => {
    if (!pdfDoc || !canvasRef.current) return;
    setSaving(true);

    try {
      const pdfjsLib = await loadPdfjs();
      // Re-open to get a fresh document reference if needed
      // Use pdf-lib approach: render all pages to canvas, reconstruct as PDF

      // For each page, render to canvas and collect as image
      const pageImages: Blob[] = [];
      const pageDimensions: Array<{ width: number; height: number }> = [];
      const renderCanvas = document.createElement("canvas");
      const renderCtx = renderCanvas.getContext("2d")!;

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2 }); // Higher quality for save
        renderCanvas.width = viewport.width;
        renderCanvas.height = viewport.height;

        // Clear canvas
        renderCtx.fillStyle = "white";
        renderCtx.fillRect(0, 0, viewport.width, viewport.height);

        await page.render({
          canvasContext: renderCtx,
          viewport,
        }).promise;

        const blob = await new Promise<Blob>((resolve) => {
          renderCanvas.toBlob(
            (b) => resolve(b!),
            "image/jpeg",
            0.95,
          );
        });
        pageImages.push(blob);
        pageDimensions.push({
          width: viewport.width / 2, // Scale back to original size in PDF points
          height: viewport.height / 2,
        });
      }

      // Build a simple PDF from images using minimal PDF spec
      const pdfBytes = await buildPdfFromImages(pageImages, pageDimensions);

      // Download
      const url = URL.createObjectURL(
        new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      const baseName = file?.name?.replace(/\.pdf$/i, "") || "document";
      link.href = url;
      link.download = `${baseName}_unlocked.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) {
      setError(e?.message || "Failed to save PDF");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPdfDoc(null);
    setStatus("idle");
    setError("");
    setNeedsPassword(false);
    setPassword("");
    setCurrentPage(1);
    setTotalPages(0);
  };

  return (
    <section className="py-12 md:py-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
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

        {/* Upload area */}
        {status === "idle" && !needsPassword && (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-opacity-100"
                : "border-gray-300 hover:border-gray-400"
            }`}
            style={
              dragOver
                ? {
                    borderColor: themeColor,
                    backgroundColor: `${themeColor}0d`,
                  }
                : undefined
            }
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
              className="hidden"
            />
            <div className="text-gray-500">
              <svg
                className="mx-auto mb-4 w-12 h-12 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <p className="font-medium mb-1">
                Drop a PDF here or click to browse
              </p>
              <p className="text-xs text-gray-400">
                Supports password-protected PDFs
              </p>
            </div>
          </div>
        )}

        {/* Password input */}
        {needsPassword && (
          <div className="border rounded-xl p-6 space-y-4">
            <div className="text-center">
              <svg
                className="mx-auto mb-3 w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              <p className="font-medium text-gray-900 mb-1">
                This PDF is password-protected
              </p>
              <p className="text-sm text-gray-500">{file?.name}</p>
            </div>
            <div className="flex gap-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter PDF password"
                className="flex-1 border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2"
                style={
                  { "--tw-ring-color": themeColor } as React.CSSProperties
                }
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              />
              <button
                onClick={handlePasswordSubmit}
                disabled={!password}
                className="text-white px-6 py-3 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: themeColor }}
              >
                Unlock
              </button>
            </div>
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
          </div>
        )}

        {/* Loading */}
        {status === "loading" && (
          <div className="text-center py-12">
            <div
              className="inline-block w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: `${themeColor} transparent ${themeColor} ${themeColor}` }}
            />
            <p className="text-sm text-gray-500 mt-3">Opening PDF...</p>
          </div>
        )}

        {/* PDF Viewer */}
        {status === "viewing" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between border rounded-lg px-4 py-2 bg-gray-50">
              <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                <span className="truncate max-w-[200px]">{file?.name}</span>
                <span className="text-gray-400">|</span>
                <span>
                  {currentPage} / {totalPages}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Zoom controls */}
                <button
                  onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
                  className="px-2 py-1 text-sm border rounded hover:bg-gray-100"
                  title="Zoom out"
                >
                  -
                </button>
                <span className="text-xs text-gray-500 w-12 text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale((s) => Math.min(3, s + 0.25))}
                  className="px-2 py-1 text-sm border rounded hover:bg-gray-100"
                  title="Zoom in"
                >
                  +
                </button>
              </div>
            </div>

            {/* Canvas */}
            <div className="border rounded-lg overflow-auto max-h-[70vh] bg-gray-100 flex justify-center p-4">
              <canvas ref={canvasRef} className="shadow-lg" />
            </div>

            {/* Page navigation */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-3">
              <button
                onClick={handleSaveUnlocked}
                disabled={saving}
                className="text-white px-6 py-3 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: themeColor }}
              >
                {saving
                  ? `Saving (${totalPages} pages)...`
                  : "Save as Unlocked PDF"}
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50"
              >
                Open Another
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              onClick={handleReset}
              className="text-sm underline hover:no-underline"
              style={{ color: themeColor }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Build a minimal valid PDF from JPEG image blobs.
 * This creates a simple PDF where each page is a full-page image.
 */
async function buildPdfFromImages(
  images: Blob[],
  dimensions: Array<{ width: number; height: number }>,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;

  function write(str: string) {
    const bytes = encoder.encode(str);
    parts.push(bytes);
    pos += bytes.length;
  }

  function writeBytes(bytes: Uint8Array) {
    parts.push(bytes);
    pos += bytes.length;
  }

  function markObj() {
    offsets.push(pos);
  }

  // Convert blobs to ArrayBuffers
  const imageBuffers: Uint8Array[] = [];
  for (const img of images) {
    const buf = await img.arrayBuffer();
    imageBuffers.push(new Uint8Array(buf));
  }

  // PDF structure:
  // Obj 1: Catalog
  // Obj 2: Pages
  // For each page: Page obj, Image XObject
  const numPages = images.length;
  const pageObjStart = 3; // First page object number
  // Each page needs 2 objects: Page + Image XObject
  const totalObjects = 2 + numPages * 2;

  // Header
  write("%PDF-1.4\n");

  // Obj 1: Catalog
  markObj();
  write("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Obj 2: Pages
  markObj();
  const kidRefs = Array.from(
    { length: numPages },
    (_, i) => `${pageObjStart + i * 2} 0 R`,
  ).join(" ");
  write(
    `2 0 obj\n<< /Type /Pages /Kids [${kidRefs}] /Count ${numPages} >>\nendobj\n`,
  );

  // For each page
  for (let i = 0; i < numPages; i++) {
    const pageObjNum = pageObjStart + i * 2;
    const imgObjNum = pageObjNum + 1;
    const w = dimensions[i].width;
    const h = dimensions[i].height;
    const imgData = imageBuffers[i];

    // Page object
    markObj();
    write(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents ${imgObjNum + numPages} 0 R /Resources << /XObject << /Img${i} ${imgObjNum} 0 R >> >> >>\nendobj\n`,
    );

    // Image XObject
    markObj();
    write(
      `${imgObjNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w * 2} /Height ${h * 2} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgData.length} >>\nstream\n`,
    );
    writeBytes(imgData);
    write("\nendstream\nendobj\n");
  }

  // Content streams (drawing commands for each page)
  for (let i = 0; i < numPages; i++) {
    const streamObjNum = pageObjStart + numPages * 2 + i;
    const w = dimensions[i].width;
    const h = dimensions[i].height;
    const content = `q ${w} 0 0 ${h} 0 0 cm /Img${i} Do Q`;

    markObj();
    write(
      `${streamObjNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
    );
  }

  // Cross-reference table
  const xrefPos = pos;
  const allObjects = 2 + numPages * 3; // catalog + pages + (page + image + content) per page
  write(`xref\n0 ${allObjects + 1}\n`);
  write("0000000000 65535 f \n");
  for (const offset of offsets) {
    write(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }

  // Trailer
  write(
    `trailer\n<< /Size ${allObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`,
  );

  // Combine all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
