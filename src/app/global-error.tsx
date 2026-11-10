"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><head><meta name="robots" content="noindex, nofollow" /></head><body>
    <main><h1>Unable to load this page</h1><button onClick={reset}>Try again</button></main>
  </body></html>;
}
