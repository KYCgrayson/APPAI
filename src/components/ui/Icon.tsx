import type { ReactElement } from "react";

/**
 * Icon — zero-dependency Ionicons renderer.
 *
 * The no-emoji rule is strictly enforced across the appai.info platform, so
 * all iconography is drawn from Ionicons (https://ionic.io/ionicons) rendered
 * as inline SVG. Path data is bundled directly in this file so there is no
 * runtime dependency on the `ionicons` package and unused icons can be tree-
 * shaken by the bundler.
 *
 * Icons inherit the surrounding text color via `fill="currentColor"` and use
 * the standard Ionicons viewBox of 0 0 512 512.
 *
 * Usage:
 *   <Icon name="globe-outline" size={20} className="text-gray-600" />
 */

// Inner SVG markup for each icon. Each value is everything that lives inside
// the outer <svg> wrapper of the corresponding Ionicons source file, with the
// outer <svg>/width/height/viewBox/xmlns attributes stripped. The component
// provides its own <svg> wrapper so these snippets can be dropped straight in.
import { ICON_PATHS } from "./icon-data";
export { ICON_NAMES } from "./icon-data";

export interface IconProps {
  name: string;
  size?: number | string;
  className?: string;
  "aria-label"?: string;
}

export function Icon({
  name,
  size = 20,
  className,
  "aria-label": ariaLabel,
}: IconProps): ReactElement | null {
  const inner = ICON_PATHS[name];
  if (!inner) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Icon] Unknown icon name: "${name}"`);
    }
    return null;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
