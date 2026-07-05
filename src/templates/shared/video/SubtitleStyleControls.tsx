"use client";

import type { StyleSpec, LanguageCode } from "../jobs/types";

export interface SubtitleStyleControlsStrings {
  fontSizeLabel?: string;
  positionLabel?: string;
  positionTop?: string;
  positionMiddle?: string;
  positionBottom?: string;
  backgroundLabel?: string;
  backgroundNone?: string;
  backgroundBox?: string;
  backgroundRounded?: string;
  animationLabel?: string;
  animationNone?: string;
  animationFade?: string;
  animationSlideUp?: string;
  displayLabel?: string;
  displaySingle?: string;
  displayBilingual?: string;
  secondaryLanguageLabel?: string;
}

interface Props {
  value: StyleSpec;
  onChange: (next: StyleSpec) => void;
  availableSecondaryLanguages: LanguageCode[];
  darkMode?: boolean;
  disabled?: boolean;
  strings?: SubtitleStyleControlsStrings;
}

const DEFAULTS: Required<SubtitleStyleControlsStrings> = {
  fontSizeLabel: "Size",
  positionLabel: "Position",
  positionTop: "Top",
  positionMiddle: "Middle",
  positionBottom: "Bottom",
  backgroundLabel: "Background",
  backgroundNone: "None",
  backgroundBox: "Box",
  backgroundRounded: "Rounded",
  animationLabel: "Animation",
  animationNone: "None",
  animationFade: "Fade",
  animationSlideUp: "Slide up",
  displayLabel: "Display",
  displaySingle: "Single language",
  displayBilingual: "Bilingual",
  secondaryLanguageLabel: "Secondary language",
};

export function SubtitleStyleControls({
  value,
  onChange,
  availableSecondaryLanguages,
  darkMode,
  disabled,
  strings,
}: Props) {
  const t = { ...DEFAULTS, ...strings };

  const labelColor = darkMode ? "text-gray-300" : "text-gray-700";
  const subColor = darkMode ? "text-gray-400" : "text-gray-500";
  const inputCls = `border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${
    darkMode ? "bg-gray-800 border-gray-600 text-gray-100" : ""
  }`;

  const set = <K extends keyof StyleSpec>(key: K, v: StyleSpec[K]) =>
    onChange({ ...value, [key]: v });

  const setBg = (
    next: Partial<NonNullable<StyleSpec["background"]>>,
  ) => onChange({ ...value, background: { ...value.background, ...next } });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="flex flex-col gap-1">
        <span className={`text-xs ${subColor}`}>{t.fontSizeLabel}</span>
        <input
          type="number"
          min={12}
          max={96}
          step={1}
          value={value.font_size_px}
          onChange={(e) =>
            set("font_size_px", Math.max(12, Math.min(96, Number(e.target.value) || 28)))
          }
          disabled={disabled}
          className={`${inputCls} w-24`}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={`text-xs ${subColor}`}>{t.positionLabel}</span>
        <select
          value={value.position}
          onChange={(e) => set("position", e.target.value as StyleSpec["position"])}
          disabled={disabled}
          className={inputCls}
        >
          <option value="top">{t.positionTop}</option>
          <option value="middle">{t.positionMiddle}</option>
          <option value="bottom">{t.positionBottom}</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={`text-xs ${subColor}`}>{t.backgroundLabel}</span>
        <select
          value={value.background?.shape ?? "none"}
          onChange={(e) =>
            setBg({
              shape: e.target.value as NonNullable<StyleSpec["background"]>["shape"],
            })
          }
          disabled={disabled}
          className={inputCls}
        >
          <option value="none">{t.backgroundNone}</option>
          <option value="box">{t.backgroundBox}</option>
          <option value="rounded">{t.backgroundRounded}</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={`text-xs ${subColor}`}>{t.animationLabel}</span>
        <select
          value={value.animation ?? "none"}
          onChange={(e) =>
            set("animation", e.target.value as StyleSpec["animation"])
          }
          disabled={disabled}
          className={inputCls}
        >
          <option value="none">{t.animationNone}</option>
          <option value="fade">{t.animationFade}</option>
          <option value="slide_up">{t.animationSlideUp}</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={`text-xs ${subColor}`}>{t.displayLabel}</span>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => set("display", "single")}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              value.display === "single"
                ? "bg-gray-900 text-white border-gray-900"
                : darkMode
                  ? "bg-gray-800 text-gray-300 border-gray-600"
                  : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            {t.displaySingle}
          </button>
          <button
            type="button"
            onClick={() => set("display", "bilingual")}
            disabled={disabled || availableSecondaryLanguages.length === 0}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors disabled:opacity-50 ${
              value.display === "bilingual"
                ? "bg-gray-900 text-white border-gray-900"
                : darkMode
                  ? "bg-gray-800 text-gray-300 border-gray-600"
                  : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            {t.displayBilingual}
          </button>
        </div>
      </label>

      {value.display === "bilingual" && availableSecondaryLanguages.length > 0 && (
        <>
          <label className="flex flex-col gap-1">
            <span className={`text-xs ${subColor}`}>
              {t.secondaryLanguageLabel}
            </span>
            <select
              value={value.secondary_language ?? availableSecondaryLanguages[0]}
              onChange={(e) => set("secondary_language", e.target.value)}
              disabled={disabled}
              className={inputCls}
            >
              {availableSecondaryLanguages.map((lc) => (
                <option key={lc} value={lc}>
                  {lc}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={`text-xs ${subColor}`}>
              {t.fontSizeLabel} (secondary)
            </span>
            <input
              type="number"
              min={8}
              max={96}
              step={1}
              value={
                value.secondary_font_size_px ??
                Math.round(value.font_size_px * 0.85)
              }
              onChange={(e) =>
                set(
                  "secondary_font_size_px",
                  Math.max(8, Math.min(96, Number(e.target.value) || 15)),
                )
              }
              disabled={disabled}
              className={`${inputCls} w-24`}
            />
          </label>
        </>
      )}

      <label className="flex flex-col gap-1">
        <span className={`text-xs ${subColor}`}>Font color</span>
        <input
          type="color"
          value={value.color}
          onChange={(e) => set("color", e.target.value)}
          disabled={disabled}
          className="h-9 w-16 cursor-pointer rounded border p-0.5"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={`text-xs ${subColor}`}>Background color</span>
        <input
          type="color"
          value={value.background?.color ?? "#000000"}
          onChange={(e) => setBg({ color: e.target.value })}
          disabled={disabled || (value.background?.shape ?? "none") === "none"}
          title={
            (value.background?.shape ?? "none") === "none"
              ? "Pick a background shape (Box/Rounded) first"
              : undefined
          }
          className="h-9 w-16 cursor-pointer rounded border p-0.5 disabled:opacity-40"
        />
      </label>
    </div>
  );
}
