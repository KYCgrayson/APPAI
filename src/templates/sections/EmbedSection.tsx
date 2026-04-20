import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
    url: string;
    title?: string;
    caption?: string;
    aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5";
    backgroundColor?: string;
  };
  themeColor: string;
  darkMode?: boolean;
}

type Provider =
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string }
  | { kind: "tiktok"; id: string; user: string }
  | { kind: "loom"; id: string }
  | { kind: "twitter"; url: string }
  | { kind: "instagram"; url: string }
  | { kind: "spotify"; path: string }
  | { kind: "codepen"; user: string; id: string }
  | { kind: "figma"; url: string }
  | null;

function detectProvider(rawUrl: string): Provider {
  const url = rawUrl.trim();

  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { kind: "youtube", id: yt[1] };

  const vi = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vi) return { kind: "vimeo", id: vi[1] };

  const tt = url.match(/tiktok\.com\/@([^/]+)\/video\/(\d+)/);
  if (tt) return { kind: "tiktok", user: tt[1], id: tt[2] };

  const lm = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (lm) return { kind: "loom", id: lm[1] };

  if (/(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+/.test(url)) {
    return { kind: "twitter", url };
  }

  if (/instagram\.com\/(?:p|reel)\/[a-zA-Z0-9_-]+/.test(url)) {
    return { kind: "instagram", url };
  }

  const sp = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (sp) return { kind: "spotify", path: `${sp[1]}/${sp[2]}` };

  const cp = url.match(/codepen\.io\/([^/]+)\/(?:pen|details)\/([a-zA-Z0-9]+)/);
  if (cp) return { kind: "codepen", user: cp[1], id: cp[2] };

  if (/figma\.com\/(?:file|proto|design|board|community\/file)\//.test(url)) {
    return { kind: "figma", url };
  }

  return null;
}

function buildEmbed(provider: NonNullable<Provider>): { src: string; defaultAspect: Props["data"]["aspectRatio"]; allow: string } {
  switch (provider.kind) {
    case "youtube":
      return {
        src: `https://www.youtube.com/embed/${provider.id}`,
        defaultAspect: "16:9",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
      };
    case "vimeo":
      return {
        src: `https://player.vimeo.com/video/${provider.id}`,
        defaultAspect: "16:9",
        allow: "autoplay; fullscreen; picture-in-picture",
      };
    case "tiktok":
      return {
        src: `https://www.tiktok.com/embed/v2/${provider.id}`,
        defaultAspect: "9:16",
        allow: "encrypted-media;",
      };
    case "loom":
      return {
        src: `https://www.loom.com/embed/${provider.id}`,
        defaultAspect: "16:9",
        allow: "fullscreen",
      };
    case "spotify":
      return {
        src: `https://open.spotify.com/embed/${provider.path}`,
        defaultAspect: "16:9",
        allow: "encrypted-media",
      };
    case "codepen":
      return {
        src: `https://codepen.io/${provider.user}/embed/${provider.id}?default-tab=result`,
        defaultAspect: "16:9",
        allow: "",
      };
    case "figma":
      return {
        src: `https://www.figma.com/embed?embed_host=appai&url=${encodeURIComponent(provider.url)}`,
        defaultAspect: "4:5",
        allow: "fullscreen",
      };
    // Twitter and Instagram don't allow plain iframe embeds cross-origin;
    // fall back to a linked card rendered by caller
    default:
      return { src: "", defaultAspect: "16:9", allow: "" };
  }
}

const ASPECT_CLASSES: Record<NonNullable<Props["data"]["aspectRatio"]>, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
};

export function EmbedSection({ data, themeColor, darkMode }: Props) {
  const safeUrl = sanitizeUrl(data.url);
  const provider = detectProvider(safeUrl);

  if (!provider) {
    return (
      <section className="py-12 md:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 rounded-lg font-medium"
            style={{ backgroundColor: themeColor, color: "#fff" }}
          >
            {data.title || "Open link"}
          </a>
          {data.caption && (
            <p className={`mt-3 text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{data.caption}</p>
          )}
        </div>
      </section>
    );
  }

  // Twitter/Instagram: render as linked preview card (no iframe)
  if (provider.kind === "twitter" || provider.kind === "instagram") {
    return (
      <section className="py-12 md:py-20 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`block rounded-2xl p-6 border transition-transform hover:scale-[1.02] ${
              darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
            }`}
          >
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: themeColor }}>
              {provider.kind === "twitter" ? "X / Twitter" : "Instagram"}
            </div>
            <div className={`font-medium ${darkMode ? "text-white" : "text-gray-900"}`}>
              {data.title || "View post"}
            </div>
            {data.caption && (
              <p className={`mt-2 text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{data.caption}</p>
            )}
          </a>
        </div>
      </section>
    );
  }

  const embed = buildEmbed(provider);
  const aspect = data.aspectRatio || embed.defaultAspect || "16:9";
  const aspectClass = ASPECT_CLASSES[aspect];
  const containerWidth = aspect === "9:16" ? "max-w-sm" : aspect === "1:1" || aspect === "4:5" ? "max-w-xl" : "max-w-4xl";

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className={`${containerWidth} mx-auto`}>
        {data.title && (
          <h2 className={`text-2xl md:text-3xl font-bold mb-6 text-center ${darkMode ? "text-white" : "text-gray-900"}`}>
            {data.title}
          </h2>
        )}
        <div className={`${aspectClass} w-full rounded-xl overflow-hidden shadow-lg`}>
          <iframe
            src={embed.src}
            title={data.title || provider.kind}
            allow={embed.allow}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
            className="w-full h-full border-0"
          />
        </div>
        {data.caption && (
          <p className={`mt-4 text-sm text-center ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
            {data.caption}
          </p>
        )}
      </div>
    </section>
  );
}
