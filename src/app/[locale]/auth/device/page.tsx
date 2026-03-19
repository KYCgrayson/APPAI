"use client";

import { useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState, Suspense } from "react";
import { useTranslations } from "next-intl";

function DeviceAuthContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const { data: session, status: sessionStatus } = useSession();
  const [state, setState] = useState<"loading" | "needLogin" | "approving" | "done" | "error">("loading");
  const [error, setError] = useState("");
  const t = useTranslations("deviceAuth");

  useEffect(() => {
    if (!code) {
      setState("error");
      setError(t("missingCode"));
      return;
    }

    if (sessionStatus === "loading") return;

    if (sessionStatus === "unauthenticated") {
      setState("needLogin");
      return;
    }

    // User is authenticated — auto-approve
    if (sessionStatus === "authenticated" && state !== "done" && state !== "approving") {
      approveDevice(code);
    }
  }, [code, sessionStatus]);

  async function approveDevice(userCode: string) {
    setState("approving");
    try {
      const res = await fetch("/api/auth/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to approve device");
      }

      setState("done");
    } catch (err: any) {
      setState("error");
      setError(err.message);
    }
  }

  function handleSignIn() {
    signIn("google", { callbackUrl: `/auth/device?code=${code}` });
  }

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">{t("invalidLink")}</h1>
          <p className="text-gray-600">{t("missingCode")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-6">{t("authorizeDevice")}</h1>

        <div className="mb-6 p-4 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-500 mb-2">{t("confirmationCode")}</p>
          <p className="text-3xl font-mono font-bold tracking-wider">{code}</p>
        </div>

        {state === "loading" && (
          <p className="text-gray-500">{t("loading")}</p>
        )}

        {state === "needLogin" && (
          <>
            <p className="text-gray-600 mb-4">
              {t("signInPrompt")}
            </p>
            <button
              onClick={handleSignIn}
              className="w-full bg-black text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t("signInGoogle")}
            </button>
          </>
        )}

        {state === "approving" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
            <p className="text-gray-500">{t("authorizing")}</p>
          </div>
        )}

        {state === "done" && (
          <div className="text-center">
            <div className="text-4xl mb-4">&#10003;</div>
            <h2 className="text-xl font-semibold text-green-600 mb-2">{t("authorized")}</h2>
            <p className="text-gray-600">{t("authorizedMessage")}</p>
          </div>
        )}

        {state === "error" && (
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">{t("error")}</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DeviceAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    }>
      <DeviceAuthContent />
    </Suspense>
  );
}
