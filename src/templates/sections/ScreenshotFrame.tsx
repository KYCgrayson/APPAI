/* eslint-disable @next/next/no-img-element -- Publisher images use arbitrary hosts. */
import { sanitizeUrl } from "@/lib/sanitize";
import styles from "./editorial.module.css";
export type ScreenshotImage = { url: string; alt?: string; kind?: string; width?: number; height?: number };
export function ScreenshotFrame({ image }: { image: ScreenshotImage }) {
  const auto = image.kind !== "phone" && image.kind !== "web";
  const phone = image.kind === "phone";
  const size = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
  return <div className={styles.screenshot}><div className={`${styles.frame} ${auto ? styles.auto : phone ? styles.phone : styles.web}`}>
    {!auto && !phone && <div aria-hidden="true" className={styles.chrome}><span /> · ·</div>}
    <img src={sanitizeUrl(image.url)} alt={image.alt || ""} width={auto ? image.width : size(image.width, phone ? 390 : 1440)} height={auto ? image.height : size(image.height, phone ? 844 : 900)} style={image.kind === "web" ? { aspectRatio: `${size(image.width, 1440)} / ${size(image.height, 900)}` } : undefined} loading="lazy" decoding="async" />
  </div></div>;
}
