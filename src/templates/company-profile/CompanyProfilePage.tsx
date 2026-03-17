interface Props {
  title: string;
  tagline?: string;
  heroImage?: string;
  content: any;
  themeColor: string;
}

export function CompanyProfilePage({ title, tagline, content, themeColor }: Props) {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="py-24 px-6 text-center" style={{ backgroundColor: themeColor }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">{title}</h1>
          {tagline && <p className="text-xl text-white/80">{tagline}</p>}
        </div>
      </section>

      {/* About */}
      {content?.about && (
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8" style={{ color: themeColor }}>About</h2>
            <div className="prose prose-lg max-w-none text-gray-600 whitespace-pre-wrap">
              {content.about}
            </div>
          </div>
        </section>
      )}

      {/* Team */}
      {content?.team && content.team.length > 0 && (
        <section className="py-20 px-6 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-16" style={{ color: themeColor }}>Team</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {content.team.map((member: any, i: number) => (
                <div key={i} className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt={member.name}
                      className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
                    />
                  ) : (
                    <div
                      className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
                      style={{ backgroundColor: themeColor }}
                    >
                      {member.name?.[0] || "?"}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold">{member.name}</h3>
                  <p className="text-sm text-gray-500 mb-2">{member.role}</p>
                  {member.bio && <p className="text-gray-600 text-sm">{member.bio}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      {content?.contactEmail && (
        <section className="py-20 px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-8" style={{ color: themeColor }}>Contact</h2>
            <a
              href={`mailto:${content.contactEmail}`}
              className="inline-block px-8 py-4 rounded-full text-white font-semibold text-lg"
              style={{ backgroundColor: themeColor }}
            >
              {content.contactEmail}
            </a>
          </div>
        </section>
      )}

      {/* Social Links */}
      {content?.socialLinks && Object.keys(content.socialLinks).length > 0 && (
        <section className="py-8 px-6 text-center border-t">
          <div className="flex gap-6 justify-center">
            {Object.entries(content.socialLinks).map(([platform, url]) => (
              <a
                key={platform}
                href={url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-800 capitalize"
              >
                {platform}
              </a>
            ))}
          </div>
        </section>
      )}

      <footer className="py-8 text-center text-sm text-gray-400 border-t">
        Hosted on AppAI
      </footer>
    </div>
  );
}
