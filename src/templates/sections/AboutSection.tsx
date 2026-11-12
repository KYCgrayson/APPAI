import { Prose } from "@/templates/shared/Prose";

interface Props {
  data: {
    subheading?: string;
    heading?: string;
    text: string;
  };
  themeColor: string;
  darkMode?: boolean;
}

export function AboutSection({ data, themeColor, darkMode, typographyActive = false }: Props & { typographyActive?: boolean }) {
  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {data.heading && (
          <h2 data-typography-role={typographyActive ? "heading" : undefined} className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-6 md:mb-8" style={{ color: themeColor }}>
            {data.heading}
          </h2>
        )}
        {data.subheading && <p className="text-center mb-6">{data.subheading}</p>}
        <Prose typographyRole={typographyActive ? "body" : undefined} className={`prose prose-sm md:prose-base max-w-none leading-relaxed ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{data.text}</Prose>
      </div>
    </section>
  );
}
