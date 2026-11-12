import { normalizeVideoData, videoDurationSeconds, type VideoData } from "./video-data.ts";
import { videoEmbedUrl, youtubeThumbnail, type VideoUrl } from "./video-url.ts";

export function videoShareUrl(pageUrl: string, sectionId: string, t: number): string {
  const url = new URL(pageUrl);
  url.searchParams.set("t", String(t));
  url.hash = sectionId;
  return url.href;
}

export function buildVideoJsonLd(input: VideoData, video: VideoUrl, pageUrl: string, sectionId: string) {
  const { data } = normalizeVideoData(input);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: data.caption || "Video",
    description: data.caption || "Video content",
  };
  const embed = videoEmbedUrl(video);
  if (embed) schema.embedUrl = embed;
  else schema.contentUrl = video.url;
  const thumbnail = data.thumbnail || youtubeThumbnail(video);
  if (thumbnail) schema.thumbnailUrl = thumbnail;
  if (data.uploadDate) schema.uploadDate = data.uploadDate;
  if (data.duration) schema.duration = data.duration;
  const duration = videoDurationSeconds(data.duration);
  if (data.moments?.length) schema.hasPart = data.moments.map((moment, index, moments) => {
    const end = moments[index + 1]?.t ?? duration;
    return {
      "@type": "Clip", name: moment.title, startOffset: moment.t,
      ...(end !== null && end !== undefined ? { endOffset: end } : {}),
      url: videoShareUrl(pageUrl, sectionId, moment.t),
    };
  });
  return schema;
}
