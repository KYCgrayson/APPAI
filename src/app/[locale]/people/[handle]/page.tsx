import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getProfile, getProfileCopy } from "@/lib/people";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string; handle: string }>;
}

function profilePath(locale: string, handle: string): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  return `${prefix}/people/${handle}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, handle } = await params;
  const profile = getProfile(handle);
  if (!profile) return {};

  const copy = getProfileCopy(profile, locale);
  const baseUrl = process.env.NEXTAUTH_URL || "https://appai.info";
  const canonical = `${baseUrl}${profilePath(locale, handle)}`;
  const languages = {
    en: `${baseUrl}${profilePath("en", handle)}`,
    "zh-TW": `${baseUrl}${profilePath("zh-TW", handle)}`,
    "zh-CN": `${baseUrl}${profilePath("zh-CN", handle)}`,
    "x-default": `${baseUrl}${profilePath("en", handle)}`,
  };

  return {
    title: `${copy.name} — ${copy.eyebrow}`,
    description: copy.tagline,
    alternates: { canonical, languages },
    openGraph: {
      title: `${copy.name} — ${copy.eyebrow}`,
      description: copy.tagline,
      type: "profile",
      url: canonical,
      locale,
    },
  };
}

const sectionLabels = {
  en: { intro: "Introduction", projects: "Selected projects", experience: "Experience", contact: "Contact" },
  "zh-TW": { intro: "簡介", projects: "參與的產品", experience: "經驗", contact: "聯絡" },
  "zh-CN": { intro: "简介", projects: "参与的产品", experience: "经验", contact: "联系" },
} as const;

export default async function PersonalWebsite({ params }: Props) {
  const { locale, handle } = await params;
  const profile = getProfile(handle);
  if (!profile) notFound();

  const copy = getProfileCopy(profile, locale);
  const labels = locale === "zh-TW" || locale === "zh-CN" ? sectionLabels[locale] : sectionLabels.en;
  const nav = locale === "zh-TW"
    ? { appai: "AppAI", websites: "網站" }
    : locale === "zh-CN"
      ? { appai: "AppAI", websites: "网站" }
      : { appai: "AppAI", websites: "Websites" };

  return (
    <main className="min-h-screen bg-[#f6f5f0] text-[#202a2b] selection:bg-[#b8d5d0] selection:text-[#163a38]">
      <header className="border-b border-[#d9dfd8]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="font-serif text-lg font-semibold tracking-tight text-[#183c39]">
            {nav.appai}<span className="ml-2 font-sans text-xs font-medium uppercase tracking-[0.2em] text-[#81908a]">/ {nav.websites}</span>
          </Link>
          <nav aria-label={locale.startsWith("zh") ? "頁面導覽" : "Page navigation"} className="flex max-w-[60%] flex-wrap justify-end gap-x-4 gap-y-2 text-right text-sm text-[#687572] sm:max-w-none sm:gap-x-8">
            <a href="#projects" className="transition-colors hover:text-[#17665e]">{labels.projects}</a>
            <a href="#experience" className="transition-colors hover:text-[#17665e]">{labels.experience}</a>
            <a href="#contact" className="transition-colors hover:text-[#17665e]">{labels.contact}</a>
            <Link href="/websites" className="hidden border-l border-[#d9dfd8] pl-5 transition-colors hover:text-[#17665e] sm:inline">
              {nav.websites} ↗
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <section id="introduction" className="grid gap-12 py-20 sm:py-28 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-20">
          <div>
            <p className="mb-7 text-xs font-semibold uppercase tracking-[0.24em] text-[#327d73]">{copy.eyebrow} <span className="px-2 text-[#a3aaa5]">/</span> APAC</p>
            <div className="flex items-center gap-5 sm:gap-7">
              <div aria-label={`${copy.name} initials`} className="flex size-[4.5rem] shrink-0 items-center justify-center rounded-full border border-[#b8ccc5] bg-[#e6ece5] font-serif text-2xl text-[#286b63] sm:size-24 sm:text-4xl">
                {profile.initials}
              </div>
              <div>
                <h1 className="font-serif text-5xl leading-[0.98] tracking-[-0.05em] sm:text-7xl">{copy.name}</h1>
                <p className="mt-3 max-w-xl text-base text-[#58716d] sm:mt-5 sm:text-xl">{copy.tagline}</p>
              </div>
            </div>
          </div>
          <div className="border-l border-[#cad5cf] pl-6 text-[15px] leading-7 text-[#53615e] sm:pl-8 sm:text-base sm:leading-8">
            {copy.introduction.map((paragraph) => <p key={paragraph} className="mb-4 last:mb-0">{paragraph}</p>)}
          </div>
        </section>

        <section aria-label={locale.startsWith("zh") ? "工作重點" : "Areas of focus"} className="grid gap-5 border-y border-[#d9dfd8] py-7 sm:grid-cols-3 sm:gap-10 sm:py-8">
          {copy.focus.map((item, index) => (
            <div key={item} className="flex gap-4 text-sm leading-6 text-[#455652] sm:block">
              <span className="font-mono text-xs text-[#4e8c80]">0{index + 1}</span>
              <p className="max-w-xs">{item}</p>
            </div>
          ))}
        </section>

        <section id="projects" className="scroll-mt-8 py-20 sm:py-28">
          <div className="mb-10 flex items-end justify-between gap-5 sm:mb-14">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#327d73]">01 / Work in progress</p>
              <h2 className="font-serif text-3xl tracking-tight sm:text-5xl">{labels.projects}</h2>
            </div>
            <p className="hidden max-w-xs text-sm leading-6 text-[#7a8580] sm:block">{locale === "zh-TW" ? "從真實問題出發，持續實作與修整。" : locale === "zh-CN" ? "从真实问题出发，持续实践与迭代。" : "Building from real problems, with room to keep learning."}</p>
          </div>
          <div className="grid border-t border-[#cfd8d2] sm:grid-cols-2">
            {copy.projects.map((project, index) => (
              <article key={project.name} className={`group border-b border-[#cfd8d2] py-7 sm:py-9 ${index % 2 === 0 ? "sm:pr-10 sm:border-r" : "sm:pl-10"}`}>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <span className="font-mono text-xs text-[#82908b]">0{index + 1}</span>
                  <span className="rounded-full border border-[#d4ddd7] px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-[#668078]">{project.category}</span>
                </div>
                <h3 className="font-serif text-2xl tracking-tight sm:text-3xl">
                  {project.href?.startsWith("https://") ? (
                    <a href={project.href} target="_blank" rel="noreferrer" className="transition-colors hover:text-[#27766b]">{project.name} <span aria-hidden className="font-sans text-base text-[#7c9990]">↗</span></a>
                  ) : project.href ? (
                    <Link href={project.href} className="transition-colors hover:text-[#27766b]">{project.name} <span aria-hidden className="font-sans text-base text-[#7c9990]">↗</span></Link>
                  ) : project.name}
                </h3>
                <p className="mt-3 max-w-lg text-sm leading-7 text-[#65716d]">{project.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="experience" className="scroll-mt-8 border-t border-[#d9dfd8] py-20 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#327d73]">02 / Perspective</p>
              <h2 className="font-serif text-3xl tracking-tight sm:text-5xl">{labels.experience}</h2>
              <p className="mt-5 max-w-sm text-sm leading-7 text-[#75807c]">{locale === "zh-TW" ? "跨越設備商務與軟體產品實作的工作經驗。" : locale === "zh-CN" ? "横跨设备商务与软件产品实践的工作经验。" : "Experience spanning equipment commercialization and hands-on software product work."}</p>
            </div>
            <div className="divide-y divide-[#d9dfd8] border-y border-[#d9dfd8]">
              {copy.experience.map((item) => (
                <article key={item.title} className="grid gap-2 py-6 sm:grid-cols-[0.7fr_1.3fr] sm:gap-8 sm:py-7">
                  <div>
                    <h3 className="font-serif text-xl">{item.title}</h3>
                  </div>
                  <p className="text-sm leading-7 text-[#65716d]">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-8 mb-16 rounded-2xl bg-[#e8ede7] px-6 py-10 sm:mb-24 sm:px-12 sm:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#327d73]">03 / Say hello</p>
              <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">{labels.contact}</h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-[#65716d]">{copy.contactNote}</p>
          </div>
        </section>
      </div>

      <footer className="border-t border-[#d9dfd8]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-xs text-[#86918b] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} {copy.name}</span>
          <Link href="/" className="transition-colors hover:text-[#327d73]">{locale.startsWith("zh") ? "由 AppAI Websites 發布" : "Published with AppAI Websites"} ↗</Link>
        </div>
      </footer>
    </main>
  );
}
