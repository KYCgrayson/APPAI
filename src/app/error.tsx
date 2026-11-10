"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-xl px-6 py-24">
    <meta name="robots" content="noindex, nofollow" />
    <h1 className="text-3xl font-bold">Unable to load this page</h1>
    <button className="mt-6 underline" onClick={reset}>Try again</button>
  </main>;
}
