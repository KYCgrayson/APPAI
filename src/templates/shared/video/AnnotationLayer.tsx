"use client";

import { useEffect, useRef, useState } from "react";

import type { Annotation } from "../jobs/types";
import {
  ANNOTATION_PRESETS,
  BUBBLE_FONT_RATIO,
  BUBBLE_MIN_FONT_PX,
  SUBTITLE_REFERENCE_HEIGHT,
} from "./types";

interface Props {
  annotations: Annotation[];
  onChange: (next: Annotation[]) => void;
  currentTimeSec: number;
  /** Index of the card being edited, or null. */
  selected: number | null;
  onSelect: (index: number | null) => void;
  /** Subtitle font size, so the card scales with the burn. */
  subtitleFontSizePx: number;
  disabled?: boolean;
}

export function AnnotationLayer({
  annotations,
  onChange,
  currentTimeSec,
  selected,
  onSelect,
  subtitleFontSizePx,
  disabled,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  // The grab offset is kept alongside the index: without it the card's
  // anchor snaps to the cursor on the first move, so grabbing a card by its
  // edge makes it jump before it moves.
  const [dragging, setDragging] = useState<{
    index: number;
    dx: number;
    dy: number;
  } | null>(null);
  // Same reference-canvas scaling the subtitle overlay uses, so a card in
  // the preview is the same fraction of the frame as it is in the burn.
  const [boxHeight, setBoxHeight] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      if (h > 0) setBoxHeight(h);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = boxHeight > 0 ? boxHeight / SUBTITLE_REFERENCE_HEIGHT : 1;

  const fontSize =
    Math.max(
      BUBBLE_MIN_FONT_PX,
      Math.round(subtitleFontSizePx * BUBBLE_FONT_RATIO),
    ) * scale;

  const update = (index: number, patch: Partial<Annotation>) => {
    const next = annotations.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  /** Pointer position as a fraction of the frame, or null before layout. */
  const pointerFraction = (clientX: number, clientY: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  return (
    <div
      ref={boxRef}
      className="absolute inset-0"
      // Only the cards take pointer events, so the video's own controls
      // stay usable everywhere else.
      style={{ pointerEvents: "none" }}
    >
      {annotations.map((note, i) => {
        // A card shows exactly when the burn shows it. No exemption for the
        // one being edited: that made a selected card sit on the frame for
        // the whole video, which read as "notes never stop".
        if (currentTimeSec < note.start || currentTimeSec >= note.end) {
          return null;
        }
        const isSelected = selected === i;
        const preset = ANNOTATION_PRESETS[note.preset ?? "note"];
        return (
          <div
            key={i}
            onPointerDown={(e) => {
              if (disabled) return;
              e.preventDefault();
              e.stopPropagation();
              const at = pointerFraction(e.clientX, e.clientY);
              if (!at) return;
              // Capture, so every move and the release land here even once
              // the cursor is off the card. Without it the moves only
              // arrived while the pointer happened to be over the card,
              // which is what made dragging stutter.
              e.currentTarget.setPointerCapture(e.pointerId);
              onSelect(i);
              setDragging({ index: i, dx: at.x - note.x, dy: at.y - note.y });
            }}
            onPointerMove={(e) => {
              if (!dragging || dragging.index !== i) return;
              const at = pointerFraction(e.clientX, e.clientY);
              if (!at) return;
              // Clamped because the contract bounds x/y — a card dragged
              // past the edge would be rejected rather than merely look wrong.
              update(i, {
                x: clamp(at.x - dragging.dx),
                y: clamp(at.y - dragging.dy),
              });
            }}
            onPointerUp={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
              setDragging(null);
            }}
            onPointerCancel={() => setDragging(null)}
            className={`absolute whitespace-nowrap rounded ${
              dragging?.index === i ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{
              pointerEvents: "auto",
              // Stops the browser panning or scrolling the page instead of
              // handing us the drag on a touch screen.
              touchAction: "none",
              // Anchor is the top centre, matching the burn's `\an8`: in ASS
              // one alignment value fixes both how the text centres and
              // which point `\pos` pins, so the drag handle is that point.
              left: `${note.x * 100}%`,
              top: `${note.y * 100}%`,
              transform: "translateX(-50%)",
              background: preset.background,
              color: preset.color,
              fontSize: `${fontSize}px`,
              padding: `${fontSize * 0.4}px ${fontSize * 0.4}px`,
              lineHeight: 1.2,
              textAlign: "center",
              outline: isSelected ? "2px solid #fff" : undefined,
              outlineOffset: "2px",
            }}
          >
            {note.text || "…"}
          </div>
        );
      })}
    </div>
  );
}
