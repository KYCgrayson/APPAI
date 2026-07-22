"use client";

import { put } from "@vercel/blob/client";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UNIVERSAL_APP_CATEGORIES } from "@/lib/universal-apps/manifest";

const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_PACKAGE_NAMES = /\.(tgz|tar\.gz)$/i;

type UploadIntent = {
  uploadId: string;
  pathname: string;
  clientToken: string;
};

type Manifest = { id: string; version: string; name: string };

function digestHex(buffer: ArrayBuffer) {
  return crypto.subtle.digest("SHA-256", buffer).then((digest) =>
    Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
}

function parseManifest(value: string): Manifest {
  const parsed = JSON.parse(value) as Partial<Manifest>;
  if (!parsed.id || !/^[a-z][a-z0-9-]{1,62}$/.test(parsed.id)) {
    throw new Error("The manifest needs a lowercase app id (for example, inventory-manager).");
  }
  if (!parsed.version || !parsed.name) {
    throw new Error("The manifest needs id, name, and version.");
  }
  return parsed as Manifest;
}

function categoryLabel(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

export function PublisherReleaseForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [manifestText, setManifestText] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [state, setState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const manifestHint = useMemo(() => {
    try {
      const manifest = parseManifest(manifestText);
      return `Publishing ${manifest.name} v${manifest.version} as ${manifest.id}.`;
    } catch {
      return "Paste the exact appai.app.json that is included at the root of this package.";
    }
  }, [manifestText]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setState("error");
      setMessage("Choose a .tgz or .tar.gz release package first.");
      return;
    }
    if (!ACCEPTED_PACKAGE_NAMES.test(file.name) || file.size > MAX_PACKAGE_BYTES) {
      setState("error");
      setMessage("Packages must be .tgz or .tar.gz and 20 MiB or smaller.");
      return;
    }

    let manifest: Manifest;
    try {
      manifest = parseManifest(manifestText);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The manifest JSON is invalid.");
      return;
    }

    setState("uploading");
    setMessage("Preparing a private, immutable package upload…");
    try {
      const digest = await digestHex(await file.arrayBuffer());
      const intentResponse = await fetch(`/api/v1/apps/${encodeURIComponent(manifest.id)}/release-packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          filename: file.name,
          sizeBytes: file.size,
          contentType: file.type || "application/gzip",
        }),
      });
      const intent = await intentResponse.json().catch(() => null) as UploadIntent | { error?: string } | null;
      if (!intentResponse.ok || !intent || !("clientToken" in intent)) {
        throw new Error((intent && "error" in intent && intent.error) || "AppAI could not prepare the package upload.");
      }

      setMessage("Uploading the private package…");
      await put(intent.pathname, file, {
        access: "private",
        contentType: file.type || "application/gzip",
        token: intent.clientToken,
        multipart: file.size >= 5 * 1024 * 1024,
      });

      setMessage("Finalizing the immutable release receipt…");
      const releaseResponse = await fetch(`/api/v1/apps/${encodeURIComponent(manifest.id)}/releases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          manifest: JSON.parse(manifestText),
          tagline,
          description,
          category,
          source: { type: "package", uploadId: intent.uploadId, digest: `sha256:${digest}`, sizeBytes: file.size },
        }),
      });
      const release = await releaseResponse.json().catch(() => null) as { releaseId?: string; status?: string; error?: string } | null;
      if (!releaseResponse.ok) throw new Error(release?.error || "The package uploaded, but AppAI could not create a release receipt.");

      setState("success");
      setMessage(`Release ${release?.releaseId ?? "receipt"} is ${release?.status ?? "PENDING"}. It is awaiting AppAI platform review.`);
      setFile(null);
      setManifestText("");
      setTagline("");
      setDescription("");
      const packageInput = event.currentTarget.elements.namedItem("package") as HTMLInputElement | null;
      if (packageInput) packageInput.value = "";
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Publishing failed. No release was activated.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-describedby="publish-help">
      <p id="publish-help" className="text-sm text-gray-600">Upload a source-only archive. AppAI validates, builds, provisions approved capabilities, and deploys after review. This form never asks for an API key.</p>
      <div>
        <label htmlFor="package" className="block text-sm font-medium text-gray-900">Release package</label>
        <input id="package" name="package" type="file" accept=".tgz,.tar.gz,application/gzip" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-gray-300 bg-white p-2 text-sm" />
        <p className="mt-1 text-xs text-gray-500">.tgz or .tar.gz, maximum 20 MiB. Exclude node_modules, build output, .git, and secrets.</p>
      </div>
      <div>
        <label htmlFor="manifest" className="block text-sm font-medium text-gray-900">appai.app.json</label>
        <textarea id="manifest" value={manifestText} onChange={(event) => setManifestText(event.target.value)} required rows={10} spellCheck={false} className="mt-2 w-full rounded-lg border border-gray-300 p-3 font-mono text-xs" placeholder={'{\n  "schemaVersion": 1,\n  "id": "inventory",\n  "name": "Inventory",\n  "version": "1.0.0"\n}'} />
        <p className="mt-1 text-xs text-gray-500">{manifestHint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-gray-900">Tagline<input value={tagline} onChange={(event) => setTagline(event.target.value)} required maxLength={140} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label>
        <label className="block text-sm font-medium text-gray-900">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal">{UNIVERSAL_APP_CATEGORIES.map((value) => <option key={value} value={value}>{categoryLabel(value)}</option>)}</select></label>
      </div>
      <label className="block text-sm font-medium text-gray-900">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} required rows={3} maxLength={4000} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" /></label>
      {state !== "idle" && <p role={state === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${state === "error" ? "bg-red-50 text-red-800" : state === "success" ? "bg-green-50 text-green-800" : "bg-blue-50 text-blue-800"}`}>{message}</p>}
      <button type="submit" disabled={state === "uploading"} className="min-h-11 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60">{state === "uploading" ? "Publishing…" : "Publish an app"}</button>
    </form>
  );
}
