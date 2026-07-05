"use client";

import { type RefObject, useEffect, useState } from "react";
import type { Subtitle, StyleSpec } from "../jobs/types";

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

  const bg = style.background ?? { shape: "none" };
  const bgColor = bg.color ?? "#000000";
  const bgOpacity = bg.opacity ?? 0.5;
  const borderRadius =
    bg.shape === "rounded" ? "8px" : bg.shape === "box" ? "2px" : "0";
  const padding = bg.shape && bg.shape !== "none" ? "0.25em 0.6em" : "0";
  const background =
    bg.shape && bg.shape !== "none" ? hexToRgba(bgColor, bgOpacity) : "transparent";

  const outline = style.outline_color
    ? `0 0 2px ${style.outline_color}, 0 0 4px ${style.outline_color}, 1px 1px 2px ${style.outline_color}`
    : "1px 1px 2px rgba(0,0,0,0.8)";

  const animationClass =
    style.animation === "fade"
      ? "subtitle-fade"
      : style.animation === "slide_up"
        ? "subtitle-slide-up"
        : "";

  const lineStyle: React.CSSProperties = {
    fontFamily: `"${style.font_family}", system-ui, sans-serif`,
    fontSize: `${style.font_size_px}px`,
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
              fontSize: `${style.secondary_font_size_px ?? style.font_size_px * 0.85}px`,
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
