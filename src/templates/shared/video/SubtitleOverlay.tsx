"use client";

import { type RefObject, useEffect, useState } from "react";
import type { Subtitle, StyleSpec } from "../jobs/types";
import { SECONDARY_FONT_RATIO, SUBTITLE_REFERENCE_HEIGHT } from "./types";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  primary: Subtitle[];
  secondary?: Subtitle[];
  style: StyleSpec;
}

function findActive(subs: Subtitle[], time: number): Subtitle | null {
  for (const s of subs) {
    if (time >= s.start && time < s.end) return s;
  }
  return null;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Renders the active subtitle segment(s) over a `<video>` element.
 * Listens to the video's `timeupdate` (and rAF for smoother updates)
 * to swap segments at boundaries. Style mirrors what the backend will
 * burn in via libass, so the live preview matches the rendered output
 * closely.
 */
export function SubtitleOverlay({ videoRef, primary, secondary, style }: Props) {
  const [time, setTime] = useState(0);
  // Rendered height of the <video> box, so px sizes authored against the
  // reference canvas land at the same fraction of the frame here as they do
  // in the burn. Without this the preview silently uses its own scale.
  const [boxHeight, setBoxHeight] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      if (h > 0) setBoxHeight(h);
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let rafId: number | null = null;

    const tick = () => {
      setTime(video.currentTime);
      if (!video.paused && !video.ended) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const onPlay = () => {
      if (rafId === null) rafId = requestAnimationFrame(tick);
    };
    const onPauseOrEnd = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setTime(video.currentTime);
    };
    const onSeek = () => setTime(video.currentTime);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPauseOrEnd);
    video.addEventListener("ended", onPauseOrEnd);
    video.addEventListener("seeked", onSeek);
    video.addEventListener("timeupdate", onSeek);

    setTime(video.currentTime);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPauseOrEnd);
      video.removeEventListener("ended", onPauseOrEnd);
      video.removeEventListener("seeked", onSeek);
      video.removeEventListener("timeupdate", onSeek);
    };
  }, [videoRef]);

  const activePrimary = findActive(primary, time);
  const activeSecondary = secondary ? findActive(secondary, time) : null;
  const showSecondary = style.display === "bilingual" && activeSecondary;

  if (!activePrimary && !showSecondary) return null;

  const positionStyle: React.CSSProperties = (() => {
    switch (style.position) {
      case "top":
        return { top: "8%", bottom: "auto" };
      case "middle":
        return { top: "50%", bottom: "auto", transform: "translateY(-50%)" };
      case "bottom":
      default:
        return { bottom: "8%", top: "auto" };
    }
  })();

  // Until the box is measured, fall back to 1:1 rather than collapsing to 0.
  const scale = boxHeight > 0 ? boxHeight / SUBTITLE_REFERENCE_HEIGHT : 1;
  const primarySize = style.font_size_px * scale;
  const secondarySize =
    (style.secondary_font_size_px ?? style.font_size_px * SECONDARY_FONT_RATIO) *
    scale;

  const bg = style.background ?? { shape: "none" };
  const bgColor = bg.color ?? "#000000";
  const bgOpacity = bg.opacity ?? 0.5;
  // Radius and shadow are authored against the reference canvas too, so they
  // shrink with the box instead of looking three times too heavy in preview.
  const borderRadius =
    bg.shape === "rounded"
      ? `${12 * scale}px`
      : bg.shape === "box"
        ? `${3 * scale}px`
        : "0";
  const padding = bg.shape && bg.shape !== "none" ? "0.25em 0.6em" : "0";
  const background =
    bg.shape && bg.shape !== "none" ? hexToRgba(bgColor, bgOpacity) : "transparent";

  const outlineColor = style.outline_color ?? "rgba(0,0,0,0.8)";
  const outline = [
    `0 0 ${3 * scale}px ${outlineColor}`,
    `0 0 ${6 * scale}px ${outlineColor}`,
    `${1.5 * scale}px ${1.5 * scale}px ${3 * scale}px ${outlineColor}`,
  ].join(", ");

  const animationClass =
    style.animation === "fade"
      ? "subtitle-fade"
      : style.animation === "slide_up"
        ? "subtitle-slide-up"
        : "";

  const lineStyle: React.CSSProperties = {
    // PingFang first: it is what the backend burns in when the requested
    // family cannot render the text, which for CJK subtitles is the norm.
    fontFamily: `"${style.font_family}", "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", system-ui, sans-serif`,
    fontSize: `${primarySize}px`,
    color: style.color,
    background,
    borderRadius,
    padding,
    textShadow: outline,
    lineHeight: 1.3,
    display: "inline-block",
    maxWidth: "90%",
  };

  return (
    <>
      <style>{`
        @keyframes subtitleFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes subtitleSlideUp { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .subtitle-fade { animation: subtitleFade 150ms ease-out }
        .subtitle-slide-up { animation: subtitleSlideUp 200ms ease-out }
      `}</style>
      <div
        aria-hidden="true"
        className="absolute left-0 right-0 pointer-events-none text-center px-4 space-y-1"
        style={positionStyle}
      >
        {activePrimary && (
          <div className={animationClass} style={lineStyle} key={`p-${activePrimary.start}`}>
            {activePrimary.text}
          </div>
        )}
        {showSecondary && activeSecondary && (
          <div
            className={animationClass}
            style={{
              ...lineStyle,
              fontSize: `${secondarySize}px`,
            }}
            key={`s-${activeSecondary.start}`}
          >
            {activeSecondary.text}
          </div>
        )}
      </div>
    </>
  );
}
