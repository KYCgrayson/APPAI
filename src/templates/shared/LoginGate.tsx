import { signIn } from "@/lib/auth";

/**
 * Platform login gate. Rendered in place of a section that declares
 * `data.access = "login"` when the visitor is anonymous. Part of the
 * interactive-tools gating primitive (docs/interactive-tools-architecture.md).
 */
export function LoginGate({
  redirectTo,
  heading,
  description,
  themeColor = "#2563eb",
}: {
  redirectTo: string;
  heading?: string;
  description?: string;
  themeColor?: string;
}) {
  return (
    <section className="px-4 py-16 min-h-[70vh] flex items-center justify-center">
      <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-lg p-8 text-center border border-gray-100">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {heading ? `Sign in to use ${heading}` : "Sign in to continue"}
        </h2>
        <p className="text-gray-600 mb-8">
          {description ?? "You need to sign in to use this tool. It's free."}
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 rounded-xl px-6 py-4 font-medium hover:bg-gray-50 transition-colors"
            style={{ color: themeColor }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </form>
      </div>
    </section>
  );
}
