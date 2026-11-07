import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
    heading?: string;
    subheading?: string;
    email?: string;
    phone?: string;
    address?: string;
    formUrl?: string;
  };
  themeColor: string;
}

export function ContactSection({ data, themeColor, typographyActive = false }: Props & { typographyActive?: boolean }) {
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
