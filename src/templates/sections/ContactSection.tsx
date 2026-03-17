import { sanitizeUrl } from "@/lib/sanitize";

interface Props {
  data: {
    email?: string;
    phone?: string;
    address?: string;
    formUrl?: string;
  };
  themeColor: string;
}

export function ContactSection({ data, themeColor }: Props) {
  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16" style={{ color: themeColor }}>
          Contact
        </h2>
        <div className="bg-white rounded-2xl p-8 shadow-sm space-y-6">
          {data.email && (
            <div className="flex items-center gap-4">
              <span className="text-2xl">&#9993;</span>
              <div>
                <p className="text-sm text-gray-400">Email</p>
                <a
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
              <span className="text-2xl">&#9742;</span>
              <div>
                <p className="text-sm text-gray-400">Phone</p>
                <a
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
              <span className="text-2xl">&#9873;</span>
              <div>
                <p className="text-sm text-gray-400">Address</p>
                <p className="font-semibold">{data.address}</p>
              </div>
            </div>
          )}
          {data.formUrl && (
            <div className="pt-4">
              <a
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
