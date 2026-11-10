export default function NotFound() {
  return <main className="mx-auto max-w-xl px-6 py-24">
    <meta name="robots" content="noindex, nofollow" />
    <h1 className="text-3xl font-bold">Page not found</h1>
    <p className="my-4">The page you requested is unavailable.</p>
    <Link href="/">AppAI</Link>
  </main>;
}
import Link from "next/link";

