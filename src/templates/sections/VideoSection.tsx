import { serializeJsonLd } from "@/lib/json-ld";
import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
    subheading?: string;
    heading?: string;
    url: string;
    caption?: string;
  };
  themeColor: string;
}

function getVideoType(url: string): "youtube" | "vimeo" | "video" | "gif" {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("vimeo.com")) return "vimeo";
  if (url.endsWith(".gif")) return "gif";
  return "video";
}

function getYouTubeEmbedUrl(url: string): string {
  const match =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/) || [];
  return match[1] ? `https://www.youtube.com/embed/${match[1]}` : url;
}

function getVimeoEmbedUrl(url: string): string {
  const match = url.match(/vimeo\.com\/(\d+)/) || [];
  return match[1] ? `https://player.vimeo.com/video/${match[1]}` : url;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

export function VideoSection({ data, themeColor, typographyActive = false }: Props & { typographyActive?: boolean }) {
  const safeUrl = sanitizeUrl(data.url);
  const type = getVideoType(safeUrl);

  const videoSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: data.caption || "Video",
    description: data.caption || "Video content",
    uploadDate: new Date().toISOString(),
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(videoSchema) }}
      />
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
        </div>
        {data.caption && (
          <p data-typography-role={typographyActive ? "caption" : undefined} className="text-center text-gray-500 mt-4 text-sm">{data.caption}</p>
        )}
      </div>
    </section>
  );
}
