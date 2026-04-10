import { Prose } from "@/templates/shared/Prose";

interface Props {
  data: {
    heading?: string;
    text: string;
  };
  themeColor: string;
}

export function AboutSection({ data, themeColor }: Props) {
  return (
    <section className="py-12 md:py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {data.heading && (
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-6 md:mb-8" style={{ color: themeColor }}>
            {data.heading}
          </h2>
        )}
        <Prose className="prose prose-sm md:prose-base max-w-none text-gray-600 leading-relaxed prose-a:text-blue-600 hover:prose-a:underline prose-headings:font-semibold">{data.text}</Prose>
      </div>
    </section>
  );
}
