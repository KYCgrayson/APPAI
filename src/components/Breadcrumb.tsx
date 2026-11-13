import type { CSSProperties, ElementType } from "react";
import { proseThemeVariables } from "@/lib/prose-theme";

import type { BreadcrumbItem } from "@/lib/breadcrumbs";
export type { BreadcrumbItem } from "@/lib/breadcrumbs";

/** One compact, scrollable trail for hosted, platform and management pages. */
export function Breadcrumb({ items, label, variant = "hosted", dark = false, themeColor, className = "", LinkComponent = "a" }: {
  items: readonly BreadcrumbItem[];
  label: string;
  variant?: "hosted" | "platform";
  dark?: boolean;
  themeColor?: string | null;
  className?: string;
  LinkComponent?: ElementType;
}) {
  if (items.length < 2) return null;
  const colors = proseThemeVariables(themeColor);
  const style = {
    backgroundColor: dark ? "#111827" : "#ffffff",
    color: dark ? "#e5e7eb" : "#374151",
    "--breadcrumb-link": colors?.[dark ? "--page-theme-link-dark" : "--page-theme-link-light"] ?? (dark ? "#67e8f9" : "#1f2937"),
  } as CSSProperties;
  return (
    <nav aria-label={label} data-breadcrumb={variant} style={style} className={`min-w-0 overflow-x-auto text-sm ${className}`}>
      <ol className="flex w-max min-w-0 max-w-full flex-nowrap items-center gap-2 whitespace-nowrap">
        {items.map(({ name, href }, index) => (
          <li key={`${index}:${href}`} className="flex min-w-0 shrink-0 items-center gap-2 whitespace-nowrap">
            {index > 0 && <span aria-hidden="true">›</span>}
            {index === items.length - 1 ? (
              <span aria-current="page" title={name} className="inline-flex min-h-6 min-w-0 items-center py-1"><span className="max-w-[60vw] truncate sm:max-w-96">{name}</span></span>
            ) : (
              <LinkComponent href={href} title={name} className="inline-flex min-h-6 min-w-0 items-center rounded px-1 py-1 text-[var(--breadcrumb-link)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"><span className="max-w-[40vw] truncate sm:max-w-72">{name}</span></LinkComponent>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
