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
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-semibold text-green-800 mb-2">
              Save this key now! It won&apos;t be shown again.
            </p>
            <code className="block bg-white p-3 rounded text-sm break-all border">
              {newKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newKey);
              }}
              className="mt-2 text-sm text-green-700 hover:underline"
            >
              Copy to clipboard
            </button>
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
                  <div className="text-sm text-gray-500">
                    <code>{key.keyPrefix}</code>
                    {" · "}
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
          </div>
        )}
      </div>
    </div>
  );
}
