"use client";

import { useEffect, useRef, useState } from "react";
import { createVideoController, trustedVideoMessage, type VideoState, type PlayerMessage } from "@/lib/video-controller";
import { registerVideoNavigation } from "@/lib/video-navigation";
import { formatVideoTime } from "@/lib/video-data";
import { videoEmbedUrl, videoTimeLink, type VideoUrl } from "@/lib/video-url";
import type { VideoStrings } from "./video-strings";

interface Props {
  video: VideoUrl;
  sectionId: string;
  startAt: number;
  thumbnail?: string;
  priority?: boolean;
  title: string;
  themeColor: string;
  strings: VideoStrings;
}

export function VideoPlayer({ video, sectionId, startAt, thumbnail, priority = false, title, themeColor, strings }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const native = useRef<HTMLVideoElement>(null);
  const control = useRef<ReturnType<typeof createVideoController> | null>(null);
  const request = useRef({ t: startAt, play: false });
  const [active, setActive] = useState(false);
  const [src, setSrc] = useState<string>();
  const [status, setStatus] = useState<{ state: VideoState; t: number }>();
  const [selected, setSelected] = useState(startAt);
  const isFile = video.kind === "file";

  useEffect(() => {
    const element = root.current;
    if (!element || video.kind === "gif") return;
    const playerKind = video.kind;
    const player = createVideoController(playerKind, startAt, (message: PlayerMessage) => {
      if (video.kind === "file") {
        const node = native.current;
        if (!node) return;
        if (message.method === "setCurrentTime") {
          try { node.currentTime = message.value as number; } catch { player.receive({ event: "error" }); }
        } else if (message.method === "play") {
          const t = request.current.t;
          void node.play().then(() => {
            if (request.current.t === t) player.receive({ event: "play" });
          }).catch(() => {
            if (request.current.t === t) player.receive({ event: "error", data: { method: "play" } });
          });
        }
      } else {
        frame.current?.contentWindow?.postMessage(video.kind === "youtube" ? JSON.stringify(message) : message,
          video.kind === "youtube" ? "https://www.youtube-nocookie.com" : "https://player.vimeo.com");
      }
    }, (state, t) => setStatus({ state, t }));
    player.request(request.current.t, false);
    control.current = player;
    let activated = Boolean(frame.current);
    if (frame.current) player.connect();
    function activate(t: number) {
      if (activated) return;
      activated = true;
      setActive(true);
      if (!isFile) setSrc(videoEmbedUrl(video, window.location.origin, t));
      player.connect();
    }
    const message = (event: MessageEvent) => {
      const value = trustedVideoMessage(event, frame.current?.contentWindow, playerKind);
      if (value) player.receive(value);
    };
    window.addEventListener("message", message);
    const unregister = registerVideoNavigation({ element, id: sectionId, initial: startAt, seek(t, userAction) {
      request.current = { t, play: userAction };
      setSelected(t);
      if (userAction) activate(t);
      player.request(t, userAction);
      // URL visits only prepare the facade; no third-party frame until a click.
      if (isFile && native.current?.readyState) player.ready();
    } });
    // This listener handles the server-rendered moment links as well as the play facade.
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-video-time]") : null;
      if (!anchor || !element.closest("section")?.contains(anchor) || anchor.target) return;
      // On failure the same anchor remains an ordinary external fallback.
      if (element.dataset.failed === "true") return;
      event.preventDefault();
      const t = Number(anchor.dataset.videoTime);
      request.current = { t, play: true }; setSelected(t); activate(t);
      player.request(t, true);
      if (isFile && native.current?.readyState) player.ready();
      const url = new URL(window.location.href);
      url.searchParams.set("t", String(t)); url.hash = sectionId;
      window.history.pushState(null, "", url);
    };
    if (isFile && startAt && native.current?.readyState) player.ready();
    document.addEventListener("click", click);
    return () => {
      unregister(); player.dispose(); control.current = null;
      document.removeEventListener("click", click); window.removeEventListener("message", message);
    };
  }, [video, sectionId, startAt, isFile]);

  function fileReady() {
    if (active || startAt || request.current.t) control.current?.ready();
  }
  const time = formatVideoTime(status?.t ?? selected);
  const statusText = status?.state === "loading" ? strings.loading
    : status?.state === "error" ? strings.failed
    : status?.state === "blocked" ? strings.jumped.replace("{time}", time)
    : status?.state === "seeked" ? strings.seeked.replace("{time}", time) : strings.ready;
  return <>
    <div ref={root} className="rounded-2xl overflow-hidden shadow-lg" data-failed={status?.state === "error" ? "true" : undefined}>
      {isFile ? <video ref={native} className="w-full" controls onLoadedMetadata={fileReady}
        onSeeked={() => control.current?.receive({ event: "seeked", data: { seconds: native.current?.currentTime } })}
        onTimeUpdate={() => control.current?.receive({ event: "timeupdate", data: { seconds: native.current?.currentTime } })}
        onPlaying={() => control.current?.receive({ event: "play" })}
        onError={() => setStatus({ state: "error", t: request.current.t })}>
        <source src={video.url} />
      </video> : <div className="relative w-full bg-black" style={{ paddingBottom: "56.25%" }}>
        {active && src ? <iframe ref={frame} className="absolute inset-0 w-full h-full" src={src} title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => control.current?.connect()}
          onError={() => setStatus({ state: "error", t: request.current.t })} />
          : <a href={videoTimeLink(video, selected)} data-video-time={selected}
            className="absolute inset-0 flex items-center justify-center focus-visible:outline-4 focus-visible:outline-offset-[-4px]"
            aria-label={strings.play} style={{ color: themeColor }}>
            {thumbnail && <img src={thumbnail} alt="" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined}
              width={480} height={360} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />}
            <span className="relative rounded-full bg-white text-black shadow-lg p-5 text-2xl" aria-hidden="true">▶</span>
          </a>}
      </div>}
    </div>
    {!isFile && <a className="inline-block text-sm underline py-3" href={videoTimeLink(video, selected)}>{video.kind === "youtube" ? strings.youtube : strings.vimeo}</a>}
    {status && <div className="mt-3 text-sm break-words">
      <p role="status" aria-live="polite">{statusText}</p>
      {(status.state === "error" || status.state === "blocked") && <a className="inline-block underline py-3" href={videoTimeLink(video, status.t)}>{strings.fallback.replace("{time}", time)}</a>}
    </div>}
  </>;
}
