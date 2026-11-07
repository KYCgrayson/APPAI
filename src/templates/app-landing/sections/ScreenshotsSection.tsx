import styles from "../../sections/editorial.module.css";
/* eslint-disable @next/next/no-img-element -- Publisher images use arbitrary hosts. */
import { sanitizeUrl } from "@/lib/sanitize";
import { ScreenshotFrame, type ScreenshotImage } from "../../sections/ScreenshotFrame";
import { legacyScreenshotContent } from "@/lib/screenshot-layout";
interface Props { data: { heading?: string; images?: (string | ScreenshotImage)[]; backgroundColor?: string }; themeColor: string; darkMode?: boolean; editorial?: boolean }
export function ScreenshotsSection({ data, themeColor, darkMode = false, editorial = false, typographyActive = false }: Props & { typographyActive?: boolean }) {
  if (!editorial) {
    const { heading, images } = legacyScreenshotContent(data);
    if (!images.length) return null;
    return <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 md:mb-16" style={{ color: themeColor }}>{heading}</h2>
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6">
          {images.map((image, i) => <div key={i} className="flex-shrink-0 snap-center">
            <img src={sanitizeUrl(image.url)} alt={image.alt} className="rounded-2xl shadow-lg h-[360px] md:h-[500px] w-auto max-w-[85vw] sm:max-w-sm object-cover" />
          </div>)}
        </div>
      </div>
    </section>;
  }
  const images = Array.isArray(data.images) ? data.images.flatMap(value => {
    const image = typeof value === "string" ? { url: value } : value;
    return image && typeof image.url === "string" && sanitizeUrl(image.url) !== "#" ? [image] : [];
  }) : [];
  if (!images.length) return null;
  return <section className={styles.section} data-dark={darkMode} style={{ overflowWrap: "anywhere", backgroundColor: data.backgroundColor || (darkMode ? "#182322" : "#f6f5f0") }}><div className={styles.inner}>
    {data.heading && <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl font-bold text-center mb-10" style={{ color: themeColor }}>{data.heading}</h2>}
    <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory">{images.map((image, i) => <div key={i} className="flex-shrink-0 snap-center max-w-[85vw] w-full sm:w-96">
      <ScreenshotFrame image={image} />
    </div>)}</div>
  </div></section>;
}
