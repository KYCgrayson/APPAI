import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const app = await db.app.findUnique({ where: { id } });
  if (!app) return {};

  return {
    title: `${app.name} - AppAI`,
    description: app.tagline,
  };
}

export default async function AppDetailPage({ params }: Props) {
  const { id } = await params;
  const app = await db.app.findUnique({ where: { id } });

  if (!app || !app.isApproved) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-xl font-bold flex items-center gap-2">
            <img src="/appai.png" alt="AppAI" className="w-7 h-7 rounded" />
            AppAI
          </Link>
          <span className="text-gray-300">/</span>
          <Link href="/apps" className="text-sm text-gray-600 hover:text-black">
            Apps
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start gap-6 mb-8">
          {app.logoUrl ? (
            <img
              src={app.logoUrl}
              alt={app.name}
              className="w-20 h-20 rounded-2xl object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500">
              {app.name[0]}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{app.name}</h1>
            <p className="text-lg text-gray-600 mt-1">{app.tagline}</p>
            <div className="flex gap-2 mt-2">
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                {app.category}
              </span>
              {app.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Download buttons */}
        <div className="flex gap-3 mb-8">
          {app.iosUrl && (
            <a
              href={app.iosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800"
            >
              App Store
            </a>
          )}
          {app.androidUrl && (
            <a
              href={app.androidUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800"
            >
              Google Play
            </a>
          )}
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 px-6 py-3 rounded-xl hover:bg-gray-50"
            >
              Website
            </a>
          )}
        </div>

        {/* Description */}
        <div className="prose max-w-none whitespace-pre-wrap text-gray-700">
          {app.description}
        </div>

        {/* Screenshots */}
        {app.screenshots.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Screenshots</h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {app.screenshots.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Screenshot ${i + 1}`}
                  className="rounded-xl shadow h-[400px] w-auto object-cover flex-shrink-0"
                />
              ))}
            </div>
          </div>
        )}

        {/* Link to hosted page */}
        {app.hostedPageSlug && (
          <div className="mt-8 p-4 bg-gray-50 rounded-xl">
            <Link
              href={`/p/${app.hostedPageSlug}`}
              className="text-blue-600 hover:underline"
            >
              View hosted landing page
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
