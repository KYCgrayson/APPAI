import { type BusinessHours, isBusinessHours, formatBusinessHours, mapLinks } from "@/lib/business-hours";
import { SmartIcon } from "@/templates/shared/SmartIcon";
import { SOCIAL_PLATFORMS, sanitizeSocialUrl, sanitizeUrl } from "@/lib/sanitize";

export const SOCIAL_NAMES = { instagram: "Instagram", line: "LINE", facebook: "Facebook", threads: "Threads", whatsapp: "WhatsApp", x: "X", youtube: "YouTube", tiktok: "TikTok", website: "Website" };
export const SOCIAL_ICONS = { instagram: "logo-instagram", line: "logo-line", facebook: "logo-facebook", threads: "logo-threads", whatsapp: "logo-whatsapp", x: "logo-twitter", youtube: "logo-youtube", tiktok: "logo-tiktok", website: "globe-outline" } satisfies Record<typeof SOCIAL_PLATFORMS[number], string>;

// Follow the locale-keyed copy pattern used by hosted page labels; unknown locales use English.
const MAP_LABELS: Record<string, string> = {
  en: "Open in {map}", "zh-TW": "在 {map} 中開啟", "zh-CN": "在 {map} 中打开",
  ja: "{map}で開く", ko: "{map}에서 열기", es: "Abrir en {map}", fr: "Ouvrir dans {map}",
  de: "In {map} öffnen", pt: "Abrir no {map}", it: "Apri in {map}", nl: "Openen in {map}",
  ru: "Открыть в {map}", ar: "فتح في {map}", hi: "{map} में खोलें", th: "เปิดใน {map}",
  vi: "Mở trong {map}", id: "Buka di {map}", ms: "Buka dalam {map}", tr: "{map} ile aç",
  pl: "Otwórz w {map}", uk: "Відкрити в {map}", sv: "Öppna i {map}", da: "Åbn i {map}",
  fi: "Avaa sovelluksessa {map}", nb: "Åpne i {map}", cs: "Otevřít v {map}",
  el: "Άνοιγμα στο {map}", he: "פתיחה ב-{map}", ro: "Deschide în {map}",
};

interface Props {
  data: {
    heading?: string;
    subheading?: string;
    email?: string;
    phone?: string;
    address?: string;
    hours?: BusinessHours[];
    note?: string;
    map?: boolean;
    formUrl?: string;
    socials?: Array<{ platform: typeof SOCIAL_PLATFORMS[number]; url: string; label?: string }>;
  };
  themeColor: string;
  locale?: string;
}

export function ContactSection({ data, themeColor, locale = "en", typographyActive = false }: Props & { typographyActive?: boolean }) {
  const mapLabel = (name: string) => (MAP_LABELS[locale] || MAP_LABELS[locale.split("-")[0]] || MAP_LABELS.en).replace("{map}", name);
  return (
    <section className="py-12 md:py-20 px-4 sm:px-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h2 data-typography-role={typographyActive ? "heading" : undefined} className={`text-3xl md:text-4xl lg:text-5xl font-bold text-center ${data.subheading ? "mb-3" : "mb-10 md:mb-16"}`} style={{ color: themeColor }}>
          {data.heading || "Contact"}
        </h2>
        {data.subheading && <p data-typography-role={typographyActive ? "body" : undefined} className={"text-center text-gray-600 mb-10 md:mb-16"}>{data.subheading}</p>}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
          {data.email && (
            <div className="flex items-center gap-4">
              <span data-typography-role={typographyActive ? "card" : undefined} className="text-2xl">&#9993;</span>
              <div className={typographyActive ? "min-w-0" : undefined}>
                <p data-typography-role={typographyActive ? "caption" : undefined} className="text-sm text-gray-400">Email</p>
                <a data-typography-role={typographyActive ? "card" : undefined}
                  href={`mailto:${data.email}`}
                  className="font-semibold hover:underline"
                  style={{ color: themeColor }}
                >
                  {data.email}
                </a>
              </div>
            </div>
          )}
          {data.phone && (
            <div className="flex items-center gap-4">
              <span data-typography-role={typographyActive ? "card" : undefined} className="text-2xl">&#9742;</span>
              <div className={typographyActive ? "min-w-0" : undefined}>
                <p data-typography-role={typographyActive ? "caption" : undefined} className="text-sm text-gray-400">Phone</p>
                <a data-typography-role={typographyActive ? "card" : undefined}
                  href={`tel:${data.phone}`}
                  className="font-semibold hover:underline"
                  style={{ color: themeColor }}
                >
                  {data.phone}
                </a>
              </div>
            </div>
          )}
          {data.address && (
            <div className="flex items-center gap-4">
              <span data-typography-role={typographyActive ? "card" : undefined} className="text-2xl">&#9873;</span>
              <div className={typographyActive ? "min-w-0" : undefined}>
                <p data-typography-role={typographyActive ? "caption" : undefined} className="text-sm text-gray-400">Address</p>
                <p data-typography-role={typographyActive ? "card" : undefined} className="font-semibold break-words">{data.address}</p>
              </div>
            </div>
          )}
          {data.map === true && data.address && <div className="flex gap-4 flex-wrap">
            <a href={mapLinks(data.address).google} target="_blank" rel="noopener noreferrer">{mapLabel("Google Maps")}</a>
            <a href={mapLinks(data.address).apple} target="_blank" rel="noopener noreferrer">{mapLabel("Apple Maps")}</a>
          </div>}
          {data.hours?.length ? <ul className="space-y-2">{data.hours.filter(isBusinessHours).map((hours, i) => <li key={i}>{formatBusinessHours(hours, locale)}{hours.note && <p>{hours.note}</p>}</li>)}</ul> : null}
          {data.note && <p>{data.note}</p>}
          {data.socials?.map((social, i) => {
            const url = sanitizeSocialUrl(social.url);
            if (url === "#" || !SOCIAL_PLATFORMS.includes(social.platform)) return null;
            return <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              data-typography-role={typographyActive ? "card" : undefined}
              className="flex items-center gap-4 font-semibold hover:underline" style={{ color: themeColor }}>
              <span aria-hidden="true"><SmartIcon value={SOCIAL_ICONS[social.platform]} /></span>
              {social.label || SOCIAL_NAMES[social.platform]}
              {social.label && <span className="sr-only">{SOCIAL_NAMES[social.platform]}</span>}
            </a>;
          })}
          {data.formUrl && (
            <div className="pt-4">
              <a data-typography-role={typographyActive ? "card" : undefined}
                href={sanitizeUrl(data.formUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-8 py-3 rounded-full text-white font-semibold transition-transform hover:scale-105"
                style={{ backgroundColor: themeColor }}
              >
                Contact Form
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
