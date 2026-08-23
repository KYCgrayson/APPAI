"use client";

import { useEffect, useRef, useState } from "react";

import type { Annotation, AnnotationPreset } from "../jobs/types";
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
  const [dragging, setDragging] = useState<number | null>(null);
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

  const moveTo = (index: number, clientX: number, clientY: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    // Clamped because the contract keeps x/y inside the frame — a card
    // dragged past the edge would be rejected by the backend rather than
    // simply looking wrong.
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    update(index, { x, y });
  };

  return (
    <div
      ref={boxRef}
      className="absolute inset-0"
      // Only the cards take pointer events, so the video's own controls
      // stay usable everywhere else.
      style={{ pointerEvents: "none" }}
      onPointerMove={(e) => {
        if (dragging === null) return;
        e.preventDefault();
        moveTo(dragging, e.clientX, e.clientY);
      }}
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
    >
      {annotations.map((note, i) => {
        const active =
          currentTimeSec >= note.start && currentTimeSec < note.end;
        const isSelected = selected === i;
        // Out of its time range a card is hidden, matching the burn — except
        // the one being edited, which has to stay reachable while you set it up.
        if (!active && !isSelected) return null;
        const preset = ANNOTATION_PRESETS[note.preset ?? "note"];
        return (
          <div
            key={i}
            onPointerDown={(e) => {
              if (disabled) return;
              e.preventDefault();
              e.stopPropagation();
              onSelect(i);
              setDragging(i);
            }}
            className={`absolute whitespace-nowrap rounded ${
              dragging === i ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{
              pointerEvents: "auto",
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
              opacity: active ? 1 : 0.5,
            }}
          >
            {note.text || "…"}
          </div>
        );
      })}
    </div>
  );
}
