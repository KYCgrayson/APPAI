import Image from "next/image";
import { ProjectReveal } from "@/components/people/ProjectReveal";
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
            {nav.appai}<span className="ml-2 font-sans text-[13px] font-medium uppercase tracking-[0.2em] text-[#81908a]">/ {nav.websites}</span>
          </Link>
          <nav aria-label={locale.startsWith("zh") ? "頁面導覽" : "Page navigation"} className="flex max-w-[60%] flex-wrap justify-end gap-x-4 gap-y-2 text-right text-sm text-[#687572] sm:max-w-none sm:gap-x-8">
            <a href="#projects" className="motion-safe:transition-colors hover:text-[#17665e]">{labels.projects}</a>
            <a href="#experience" className="motion-safe:transition-colors hover:text-[#17665e]">{labels.experience}</a>
            <a href="#contact" className="motion-safe:transition-colors hover:text-[#17665e]">{labels.contact}</a>
            <Link href="/websites" className="hidden border-l border-[#d9dfd8] pl-5 motion-safe:transition-colors hover:text-[#17665e] sm:inline">
              {nav.websites} ↗
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <section id="introduction" className="grid gap-12 py-20 sm:py-28 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-20">
          <div>
            <p className="mb-7 text-[13px] font-semibold uppercase tracking-[0.24em] text-[#b0461f]">{copy.eyebrow} <span className="px-2 text-[#a3aaa5]">/</span> APAC</p>
            <div className="flex items-center gap-5 sm:gap-7">
              <div aria-label={profile.avatar ? undefined : `${copy.name} initials`} className="flex size-[4.5rem] shrink-0 items-center justify-center rounded-full border border-[#b8ccc5] bg-[#e6ece5] font-serif text-2xl text-[#286b63] sm:size-24 sm:text-4xl">
                {profile.avatar ? <Image src={profile.avatar.src} alt={profile.avatar.alt} width={96} height={96} className="size-full rounded-full object-cover" /> : profile.initials}
              </div>
              <div>
                <h1 className="font-serif text-5xl leading-[0.98] tracking-[-0.05em] sm:text-7xl">{copy.name}</h1>
                <p className="mt-3 max-w-xl text-base text-[#58716d] sm:mt-5 sm:text-xl">{copy.tagline}</p>
              </div>
            </div>
          </div>
          <div className="border-l border-[#cad5cf] pl-6 text-[17px] leading-8 text-[#53615e] sm:pl-8 sm:text-lg sm:leading-8">
            {copy.introduction.map((paragraph) => <p key={paragraph} className="mb-4 last:mb-0">{paragraph}</p>)}
          </div>
        </section>

        <section aria-label={locale.startsWith("zh") ? "工作重點" : "Areas of focus"} className="grid gap-5 border-y border-[#d9dfd8] py-7 sm:grid-cols-3 sm:gap-10 sm:py-8">
          {copy.focus.map((item, index) => (
            <div key={item} className="flex gap-4 text-base leading-7 sm:text-[17px] text-[#455652] sm:block">
              <span className="font-mono text-[13px] text-[#4e8c80]">0{index + 1}</span>
              <p className="max-w-xs">{item}</p>
            </div>
          ))}
        </section>

        <section id="projects" className="scroll-mt-8 py-20 sm:py-28">
          <div className="mb-10 flex items-end justify-between gap-5 sm:mb-14">
            <div>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.22em] text-[#b0461f]">01 / Work in progress</p>
              <h2 className="font-serif text-3xl tracking-tight sm:text-5xl">{labels.projects}</h2>
            </div>
            <p className="hidden max-w-xs text-base leading-7 sm:text-[17px] text-[#7a8580] sm:block">{locale === "zh-TW" ? "從真實問題出發，持續實作與修整。" : locale === "zh-CN" ? "从真实问题出发，持续实践与迭代。" : "Building from real problems, with room to keep learning."}</p>
          </div>
          <ProjectReveal>
            {copy.projects.map((project, index) => (
              <article key={project.name} className={`min-w-0 border-b border-[#cfd8d2] py-9 md:py-12 ${index % 2 === 0 ? "md:border-r md:pr-10" : "md:pl-10"}`}>
                <div className="flex items-center gap-4">
                  {project.icon ? <Image src={project.icon.src} alt="" width={64} height={64} loading="lazy" className="size-16 shrink-0 rounded-2xl border border-[#d4ddd7] shadow-sm" /> : <span role="img" aria-label={`${project.name} icon`} className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-[#b8ccc5] bg-[#e6ece5] font-serif text-3xl text-[#286b63]">{project.name.charAt(0)}</span>}
                  <div className="min-w-0">
                    <p className="mb-1 text-[13px] leading-5 text-[#b0461f]">{project.category}</p>
                    <h3 className="font-serif text-[28px] leading-tight tracking-tight sm:text-[32px]">{project.name}</h3>
                  </div>
                </div>
                <p className="mt-5 max-w-lg text-base leading-7 text-[#53615e] sm:text-[17px] sm:leading-8">{project.description}</p>
                {project.screenshot && (
                  <div className="mt-7 flex min-h-0 items-center justify-center rounded-2xl border border-[#d9dfd8] bg-[#edf0e9] px-4 py-6 sm:px-6 sm:py-8">
                    <div className={`overflow-hidden border border-[#c7d1ca] bg-[#f6f5f0] shadow-[0_12px_28px_-12px_#183c3940] motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1 ${project.screenshot.kind === "phone" ? "w-[210px] max-w-full rounded-[24px]" : "w-full rounded-lg"}`}>
                      {project.screenshot.kind === "web" && <div aria-hidden="true" className="flex h-6 items-center gap-1 border-b border-[#d9dfd8] px-3"><span className="size-1.5 rounded-full bg-[#b0461f]" /><span className="size-1.5 rounded-full bg-[#bbc9c0]" /><span className="size-1.5 rounded-full bg-[#bbc9c0]" /></div>}
                      <Image src={project.screenshot.src} alt={project.screenshot.alt} width={project.screenshot.width} height={project.screenshot.height} loading="lazy" sizes={project.screenshot.kind === "phone" ? "210px" : "(max-width: 767px) 85vw, 460px"} className="h-auto w-full" />
                    </div>
                  </div>
                )}
                {project.links.length > 0 && <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-[15px] text-[#286b63]">
                  {project.links.map((link) => {
                    const style = "underline decoration-[#b0461f]/60 underline-offset-4 hover:text-[#b0461f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b0461f]";
                    return link.href.startsWith("https://") ? <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={style}>{link.label} ↗</a> : link.href.startsWith("/p/") ? <a key={link.href} href={link.href} className={style}>{link.label} ↗</a> : <Link key={link.href} href={link.href} className={style}>{link.label} ↗</Link>;
                  })}
                </div>}
              </article>
            ))}
          </ProjectReveal>
        </section>

        <section id="experience" className="scroll-mt-8 border-t border-[#d9dfd8] py-20 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.22em] text-[#b0461f]">02 / Perspective</p>
              <h2 className="font-serif text-3xl tracking-tight sm:text-5xl">{labels.experience}</h2>
              <p className="mt-5 max-w-sm text-base leading-7 sm:text-[17px] sm:leading-8 text-[#75807c]">{locale === "zh-TW" ? "跨越設備商務與軟體產品實作的工作經驗。" : locale === "zh-CN" ? "横跨设备商务与软件产品实践的工作经验。" : "Experience spanning equipment commercialization and hands-on software product work."}</p>
            </div>
            <div className="divide-y divide-[#d9dfd8] border-y border-[#d9dfd8]">
              {copy.experience.map((item) => (
                <article key={item.title} className="grid gap-2 py-6 sm:grid-cols-[0.7fr_1.3fr] sm:gap-8 sm:py-7">
                  <div>
                    <h3 className="font-serif text-xl">{item.title}</h3>
                  </div>
                  <p className="text-base leading-7 sm:text-[17px] sm:leading-8 text-[#65716d]">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-8 mb-16 rounded-2xl bg-[#e8ede7] px-6 py-10 sm:mb-24 sm:px-12 sm:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.22em] text-[#b0461f]">03 / Say hello</p>
              <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">{labels.contact}</h2>
            </div>
            <div className="max-w-md text-base leading-7 text-[#65716d] sm:text-[17px]">
              <p>{copy.contactNote}</p>
              {(profile.links.linkedin !== null || profile.links.youtube !== null) && <div className="mt-3 flex flex-wrap gap-5">
                {profile.links.linkedin && <a href={profile.links.linkedin} target="_blank" rel="noreferrer" className="underline decoration-[#b0461f] underline-offset-4">LinkedIn ↗</a>}
                {profile.links.youtube && <a href={profile.links.youtube} target="_blank" rel="noreferrer" className="underline decoration-[#b0461f] underline-offset-4">YouTube ↗</a>}
              </div>}
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-[#d9dfd8]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-[13px] text-[#86918b] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} {copy.name}</span>
          <Link href="/" className="motion-safe:transition-colors hover:text-[#b0461f]">{locale.startsWith("zh") ? "由 AppAI Websites 發布" : "Published with AppAI Websites"} ↗</Link>
        </div>
      </footer>
    </main>
  );
}
