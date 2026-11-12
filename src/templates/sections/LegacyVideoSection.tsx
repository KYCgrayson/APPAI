import { serializeJsonLd } from "@/lib/json-ld";
import { isSafeLegacyVideoUrl } from "@/lib/video-url";
import { videoName } from "@/lib/video-jsonld";

import type { ReactNode } from "react";
import type { VideoData } from "@/lib/video-data";

interface Props {
  data: VideoData;
  themeColor: string;
  typographyActive?: boolean;
  pageTitle?: string;
  seoHeading?: string;
  moments?: ReactNode;
}

/** Preserves origin/main media markup for URLs outside the moments contract. */
function getVideoType(url: URL): "youtube" | "vimeo" | "video" | "gif" | "link" {
  if (/(?:^|\.)(?:youtube\.com|youtube-nocookie\.com)$/.test(url.hostname) || url.hostname === "youtu.be") return "youtube";
  if (/(?:^|\.)vimeo\.com$/.test(url.hostname)) return "vimeo";
  if (url.href.endsWith(".gif")) return "gif";
  if (/\.(?:mp4|webm|m3u8|mpd|mov|m4v|ogv|ogg|avi|mkv|flv|ts|mpeg|mpg|3gp|gif)$/i.test(url.pathname)) return "video";
  return "link";
}

function getYouTubeEmbedUrl(url: string): string {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : url;
}

function getVimeoEmbedUrl(url: string): string {
  const match = new URL(url).pathname.match(/^\/(\d+)/) || [];
  return match[1] ? `https://player.vimeo.com/video/${match[1]}` : url;
}

function getYouTubeId(url: string): string | null {
  const parsed = new URL(url);
  const candidate = parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : parsed.pathname === "/watch" ? parsed.searchParams.get("v") : null;
  const match = candidate?.match(/^([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

export function LegacyVideoSection({ data, themeColor, typographyActive = false, pageTitle, seoHeading, moments }: Props) {
  if (!isSafeLegacyVideoUrl(data.url)) return <section className="py-12 md:py-20 px-4 sm:px-6"><p>Video unavailable</p></section>;
  const safeUrl = data.url;
  const parsed = new URL(safeUrl);
  const type = getVideoType(parsed);

  const name = videoName({ ...data, heading: seoHeading ?? data.heading }, pageTitle);
  const videoSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name,
    ...(data.caption?.trim() ? { description: data.caption.trim() } : {}),
    ...(data.uploadDate ? { uploadDate: data.uploadDate } : {}),
    ...(data.duration ? { duration: data.duration } : {}),
  };
  if (type === "youtube") {
    const id = getYouTubeId(safeUrl);
    videoSchema.embedUrl = getYouTubeEmbedUrl(safeUrl);
    videoSchema.contentUrl = safeUrl;
    if (id) videoSchema.thumbnailUrl = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  } else if (type === "vimeo") {
    videoSchema.embedUrl = getVimeoEmbedUrl(safeUrl);
    videoSchema.contentUrl = safeUrl;
  } else {
    videoSchema.contentUrl = safeUrl;
  }

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      {data.heading && <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl font-bold text-center mb-6" style={{ color: themeColor }}>{data.heading}</h2>}
      {data.subheading && <p className="text-center mb-6">{data.subheading}</p>}
      {name && <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(videoSchema) }}
      />}
      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl overflow-hidden shadow-lg">
          {type === "youtube" && (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={getYouTubeEmbedUrl(safeUrl)}
                title="Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {type === "vimeo" && (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={getVimeoEmbedUrl(safeUrl)}
                title="Video"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {type === "video" && (
            <video className="w-full" controls>
              <source src={safeUrl} />
            </video>
          )}
          {type === "gif" && (
            <img src={safeUrl} alt={data.caption || "Animation"} className="w-full" />
          )}
          {type === "link" && (
            <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-2 p-6 underline">
              <span>Open video</span>
              <span>{parsed.hostname}</span>
            </a>
          )}
        </div>
        {data.caption && (
          <p data-typography-role={typographyActive ? "caption" : undefined} className="text-center text-gray-500 mt-4 text-sm">{data.caption}</p>
        )}
        {moments}
      </div>
    </section>
  );
}
