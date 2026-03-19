"use client";

import { useState, useEffect } from "react";

interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  name: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
        copied
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {copied ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label || "Copy"}
        </>
      )}
    </button>
  );
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [keyName, setKeyName] = useState("Default API Key");

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    const res = await fetch("/api/v1/keys");
    if (res.ok) {
      setKeys(await res.json());
    }
  }

  async function createKey() {
    setLoading(true);
    const res = await fetch("/api/v1/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: keyName }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewKey(data.apiKey);
      setKeyName("Default API Key");
      fetchKeys();
    }
    setLoading(false);
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await fetch("/api/v1/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchKeys();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">API Keys</h1>

      {/* Generate New Key */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
        <h2 className="text-lg font-semibold mb-4">Generate New Key</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name"
            className="flex-1 border rounded-lg px-4 py-2"
          />
          <button
            onClick={createKey}
            disabled={loading}
            className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {newKey && (
          <div className="mt-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-green-800">
                Save this key now! It won&apos;t be shown again.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white p-3 rounded-lg border">
              <code className="flex-1 text-sm break-all font-mono select-all">
                {newKey}
              </code>
              <CopyButton text={newKey} label="Copy Key" />
            </div>
          </div>
        )}
      </div>

      {/* Existing Keys */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Your API Keys</h2>
        {keys.length === 0 ? (
          <p className="text-gray-500">No API keys yet. Generate one above.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between border rounded-lg p-4"
              >
                <div>
                  <div className="font-medium">{key.name}</div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <code className="bg-gray-50 px-2 py-0.5 rounded font-mono">{key.keyPrefix}••••••</code>
                    <CopyButton text={key.keyPrefix} label="Copy Prefix" />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt &&
                      ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      key.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {key.isActive ? "Active" : "Revoked"}
                  </span>
                  {key.isActive && (
                    <button
                      onClick={() => revokeKey(key.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-2">
              For security, full API keys are only shown once at creation. If you lost your key, revoke it and generate a new one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
