import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
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

export function VideoSection({ data, themeColor }: Props) {
  const safeUrl = sanitizeUrl(data.url);
  const type = getVideoType(safeUrl);

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
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
          <p className="text-center text-gray-500 mt-4 text-sm">{data.caption}</p>
        )}
      </div>
    </section>
  );
}
