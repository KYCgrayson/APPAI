/* eslint-disable @next/next/no-img-element -- Publisher images use arbitrary hosts. */
import type { CSSProperties } from "react";
import { sanitizeUrl } from "@/lib/sanitize";
import { editorialLink } from "@/lib/hosted-editorial-links";
import { PLATFORM_ORIGIN } from "@/lib/platform-identity";
import styles from "./gallery.module.css";

interface Props {
  data: {
    subheading?: string;
    heading?: string;
    layout?: "masonry" | "grid";
    aspect?: "16:9" | "1:1" | "4:3" | "4:5";
    columns?: number;
    items: Array<{
      url: string;
      caption?: string;
      type?: "image" | "video";
      href?: string;
      badge?: string;
      alt?: string;
    }>;
  };
  themeColor: string;
}

const aspects = { "16:9": styles.wide, "1:1": styles.square, "4:3": styles.landscape, "4:5": styles.portrait };

export function GallerySection({ data, themeColor, typographyActive = false }: Props & { typographyActive?: boolean }) {
  const items = data.items || [];
  if (items.length === 0) return null;
  const grid = data.layout === "grid";
  const columns = data.columns === 2 || data.columns === 4 ? data.columns : 3;

  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>
          {data.heading ?? "Gallery"}
        </h2>
        {data.subheading && <p className="text-center mb-6">{data.subheading}</p>}
        <div className={grid ? styles.grid : "columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4"}
          style={grid ? { "--gallery-columns": columns, "--gallery-tablet-columns": Math.min(columns, 3) } as CSSProperties : undefined}>
          {items.map((item, i) => {
            const link = item.type !== "video" ? editorialLink(item.href, PLATFORM_ORIGIN, "project-card") : undefined;
            const Tag = link ? "a" : "div";
            const alt = item.alt ?? (item.caption || `Gallery item ${i + 1}`);
            const badge = typeof item.badge === "string" ? item.badge.trim() : "";
            const badgePill = badge ? <span className={styles.badge} title={badge}>{badge}</span> : null;
            const media = item.type === "video" ? (
              <video className={grid ? styles.video : "w-full"} controls preload={grid ? "none" : undefined}>
                <source src={sanitizeUrl(item.url)} />
              </video>
            ) : (
              <img src={sanitizeUrl(item.url)} alt={alt} className={grid ? styles.image : "w-full"}
                loading={grid ? (i < columns ? "eager" : "lazy") : undefined} decoding={grid ? "async" : undefined} />
            );
            return (
              <Tag key={i} className={["break-inside-avoid rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow", grid && styles.tile, !grid && badge && styles.badged, link && styles.link].filter(Boolean).join(" ")}
                href={link?.href} target={link?.external ? "_blank" : undefined} rel={link?.external ? "noreferrer" : undefined}
                style={link ? { "--gallery-accent": themeColor } as CSSProperties : undefined}
                aria-label={link ? [badge, item.caption || alt || `Gallery item ${i + 1}`].filter(Boolean).join(" — ") : undefined}>
                {grid ? <div className={`${styles.media} ${aspects[data.aspect || "16:9"] || styles.wide}`}>
                  {media}
                  {badgePill}
                </div> : <>{media}{badgePill}</>}
                {item.caption && (
                  <p data-typography-role={typographyActive ? "caption" : undefined} className={grid ? styles.caption : "text-sm text-gray-500 p-3"}>{item.caption}</p>
                )}
              </Tag>
            );
          })}
        </div>
      </div>
    </section>
  );
}
