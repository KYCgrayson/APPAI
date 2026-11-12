import { serializeJsonLd } from "@/lib/json-ld";
import { normalizeVideoData, formatVideoTime, type VideoData } from "@/lib/video-data";
import { parseVideoUrl, videoTimeLink, youtubeThumbnail } from "@/lib/video-url";
import { buildVideoJsonLd } from "@/lib/video-jsonld";
import { Prose } from "../shared/Prose";
import { VideoPlayer } from "./VideoPlayer";
import { videoStrings } from "./video-strings";

interface Props {
  data: VideoData;
  themeColor: string;
  typographyActive?: boolean;
  locale?: string;
  sectionId?: string;
  pageUrl?: string;
}

export function VideoSection({ data: input, themeColor, typographyActive = false, locale = "en", sectionId = "video", pageUrl = "https://appai.info/" }: Props) {
  const strings = videoStrings(locale);
  const { data, issues } = normalizeVideoData(input);
  const video = parseVideoUrl(data.url);
  if (!video || issues.length) return <section className="py-12 md:py-20 px-4 sm:px-6"><p>{strings.unavailable}</p></section>;
  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      {data.heading && <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl font-bold text-center mb-6" style={{ color: themeColor }}>{data.heading}</h2>}
      {data.subheading && <p className="text-center mb-6">{data.subheading}</p>}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildVideoJsonLd(data, video, pageUrl, sectionId)) }} />
      <div className="max-w-4xl mx-auto">
        {video.kind === "gif" ? <div className="rounded-2xl overflow-hidden shadow-lg"><img src={video.url} alt={data.caption || "Animation"} className="w-full" /></div>
          : <VideoPlayer key={`${pageUrl}#${sectionId}:${video.url}:${data.startAt ?? 0}`} video={video} sectionId={sectionId} startAt={data.startAt ?? 0}
            thumbnail={data.thumbnail || youtubeThumbnail(video)} title={data.caption || strings.play}
            themeColor={themeColor} strings={strings} />}
        {data.caption && <p data-typography-role={typographyActive ? "caption" : undefined} className="text-center text-gray-500 mt-4 text-sm">{data.caption}</p>}
        {!!data.moments?.length && <div className="mt-8 min-w-0">
          <h3 className="text-xl font-semibold mb-3 break-words" style={{ color: themeColor }}>{data.momentsHeading || strings.heading}</h3>
          <ol className="space-y-3">
            {data.moments.map(moment => <li key={moment.t} className="min-w-0 break-words">
              <a href={videoTimeLink(video, moment.t)} data-video-time={moment.t}
                className="inline-flex max-w-full min-h-11 items-center gap-3 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">
                <span className="font-mono tabular-nums shrink-0">{formatVideoTime(moment.t)}</span>
                <span className="min-w-0 font-semibold">{moment.title}</span>
              </a>
              {moment.text && <Prose className="text-sm leading-relaxed [&_p]:my-2 [&_a]:underline [&_a]:underline-offset-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" typographyRole={typographyActive ? "body" : undefined}>{moment.text}</Prose>}
            </li>)}
          </ol>
        </div>}
      </div>
    </section>
  );
}
