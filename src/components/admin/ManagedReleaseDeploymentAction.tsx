"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ActionState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function responseErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "The platform could not complete this deployment.";
}

export function ManagedReleaseDeploymentAction({
  releaseId,
  retry = false,
}: {
  releaseId: string;
  retry?: boolean;
}) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [state, setState] = useState<ActionState>({ kind: "idle" });

  async function startDeployment() {
    setIsRunning(true);
    setState({ kind: "idle" });

    try {
      // This trusted endpoint derives source, capabilities, database provisioning,
      // and provider settings from the reviewed release. The browser sends no input.
      const response = await fetch(`/api/admin/universal-apps/releases/${encodeURIComponent(releaseId)}/deployments`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseErrorMessage(payload));
      }

      setState({ kind: "success", message: "Platform deployment activated. Refreshing its status…" });
      router.refresh();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "The platform could not complete this deployment.",
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={startDeployment}
        disabled={isRunning}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRunning ? "Deploying…" : retry ? "Retry platform deployment" : "Start platform deployment"}
      </button>
      {state.kind !== "idle" && (
        <p
          role="status"
          className={`text-xs ${state.kind === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
