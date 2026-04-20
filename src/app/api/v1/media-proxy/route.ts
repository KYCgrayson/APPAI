import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface MediaDownloaderData {
  apiBase?: string;
  apiToken?: string;
}

function findMediaSection(content: any): MediaDownloaderData | null {
  const sections = content?.sections;
  if (!Array.isArray(sections)) return null;
  const section = sections.find((s: any) => s.type === "media-downloader");
  if (!section?.data?.apiBase) return null;
  return { apiBase: section.data.apiBase, apiToken: section.data.apiToken };
}

// POST /api/v1/media-proxy?slug=xxx&action=download
// GET  /api/v1/media-proxy?slug=xxx&action=file&fileId=xxx  (triggered by <a download>)
async function handle(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get("slug");
  const action = searchParams.get("action");

  if (!slug || !action) {
    return NextResponse.json({ error: "Missing slug or action" }, { status: 400 });
  }

  const page = await db.hostedPage.findFirst({
    where: { slug, isPublished: true, parentSlug: null },
    select: { content: true },
  });

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const media = findMediaSection(page.content);
  if (!media?.apiBase) {
    return NextResponse.json({ error: "No media-downloader section found" }, { status: 404 });
  }

  const headers: Record<string, string> = {};
  if (media.apiToken) headers.token = media.apiToken;

  if (action === "download") {
    const url = searchParams.get("url");
    const format = searchParams.get("format") || "video";
    const quality = searchParams.get("quality") || "720";
    const subtitles = searchParams.get("subtitles") || "false";

    if (!url) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    const params = new URLSearchParams({ url, format, quality, subtitles });

    try {
      const res = await fetch(`${media.apiBase}/download?${params}`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(120_000),
      });

      const body = await res.json().catch(() => ({}));
      return NextResponse.json(body, { status: res.status });
    } catch {
      return NextResponse.json({ error: "Upstream request failed" }, { status: 502 });
    }
  }

  if (action === "file") {
    const fileId = searchParams.get("fileId");
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
    }

    const fileUrl = new URL(`${media.apiBase}/file/${encodeURIComponent(fileId)}`);
    if (media.apiToken) fileUrl.searchParams.set("token", media.apiToken);

    try {
      const res = await fetch(fileUrl, {
        signal: AbortSignal.timeout(300_000),
      });

      if (!res.ok) {
        return NextResponse.json({ error: "File not found" }, { status: res.status });
      }

      const responseHeaders = new Headers();
      const contentType = res.headers.get("content-type");
      const contentDisposition = res.headers.get("content-disposition");
      const contentLength = res.headers.get("content-length");
      if (contentType) responseHeaders.set("content-type", contentType);
      if (contentDisposition) responseHeaders.set("content-disposition", contentDisposition);
      if (contentLength) responseHeaders.set("content-length", contentLength);

      return new NextResponse(res.body, { status: 200, headers: responseHeaders });
    } catch {
      return NextResponse.json({ error: "Upstream request failed" }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export const GET = handle;
export const POST = handle;
