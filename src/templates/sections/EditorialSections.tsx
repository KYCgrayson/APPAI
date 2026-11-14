/* eslint-disable @next/next/no-img-element -- Publisher images use arbitrary HTTPS hosts. */
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { editorialImageUrl, editorialLink } from "@/lib/hosted-editorial-links";
import { projectCardMediaSchema, type ProjectCardMedia } from "@/lib/project-cards";
import { PLATFORM_ORIGIN } from "@/lib/platform-identity";
import { Prose } from "../shared/Prose";
import { ScreenshotFrame } from "./ScreenshotFrame";
import { ProjectReveal } from "./ProjectReveal";
import styles from "./editorial.module.css";

type Image = { url: string; alt?: string };
type Link = { label: string; url: string };
type Base = { subheading?: string; heading?: string; eyebrow?: string; intro?: string; backgroundColor?: string };
type Props<T> = { data: T; themeColor: string; darkMode?: boolean };

// Normalize publisher JSON at the rendering boundary, including nested records.
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function image(value: unknown): Image {
  const item = record(value);
  return { url: text(item.url), alt: text(item.alt) };
}
function links(value: unknown): Link[] {
  return Array.isArray(value) ? value.map((value) => {
    const item = record(value);
    return { label: text(item.label), url: text(item.url) };
  }).filter((item) => !!item.label) : [];
}
function base(value: unknown): Base {
  const data = record(value);
  return { subheading: text(data.subheading), heading: text(data.heading), eyebrow: text(data.eyebrow), intro: text(data.intro), backgroundColor: text(data.backgroundColor) };
}
function dimension(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

// Preserve the chosen hue while keeping small accent text readable.
function readableAccent(color: string, dark: boolean) {
  const rgb = /^#[\da-f]{6}$/i.test(color) ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) : [176, 70, 31];
  const luminance = (values: number[]) => values.map((v) => {
    const s = v / 255;
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
  }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const bg = dark ? .013 : luminance([246, 245, 240]);
  for (let i = 0; i < 30; i++) {
    const fg = luminance(rgb);
    if ((Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05) >= 4.5) break;
    for (let j = 0; j < 3; j++) rgb[j] = dark ? Math.min(255, rgb[j] + 10) : Math.floor(rgb[j] * .9);
  }
  return `rgb(${rgb.join(",")})`;
}
function Shell({ data, themeColor, darkMode = false, children }: Props<Base> & { children: ReactNode }) {
  return <section className={styles.section} data-dark={darkMode} style={{
    "--accent": readableAccent(themeColor, darkMode),
    backgroundColor: data.backgroundColor || (darkMode ? "#182322" : "#f6f5f0"),
  } as CSSProperties}><div className={styles.inner}>{children}</div></section>;
}
function Heading({ data, typographyActive = false }: { data: Base; typographyActive?: boolean }) {
  return <>{data.eyebrow && <p data-typography-role={typographyActive ? "caption" : undefined} className={styles.eyebrow}>{data.eyebrow}</p>}{data.heading && <h2 data-typography-role={typographyActive ? "heading" : undefined} className={styles.heading}>{data.heading}</h2>}{data.subheading && <p data-typography-role={typographyActive ? "body" : undefined} className={styles.description}>{data.subheading}</p>}</>;
}
function Links({ items, inline = false }: { items?: Link[]; inline?: boolean }) {
  const origin = process.env.NEXTAUTH_URL || "https://appai.info";
  const valid = links(items).flatMap((item) => {
    const link = editorialLink(item.url, origin);
    return link && !link.href.startsWith("#") ? [{ ...item, ...link }] : [];
  });
  if (!valid?.length) return null;
  if (inline) return <div className={styles.feedLinks}>{valid.map((item, i) => <Fragment key={i}>{i > 0 && <span aria-hidden="true"> · </span>}<a href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined}>{item.label}</a></Fragment>)}</div>;
  return <div className={styles.links}>{valid.map((item, i) => (
    <a key={i} href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined}>{item.label}</a>
  ))}</div>;
}
export function ProfileHeaderSection(props: (Props<Base & {
  name: string; tagline?: string; avatar?: Image; links?: Link[]; nav?: { label: string; href: string }[];
}>) & { typographyActive?: boolean }) {
  const raw = record(props.data);
  const data = { ...base(raw), name: text(raw.name), tagline: text(raw.tagline), avatar: image(raw.avatar), links: links(raw.links) };
  const nav = Array.isArray(raw.nav) ? raw.nav.map((value) => {
    const item = record(value);
    return { label: text(item.label), href: text(item.href) };
  }).filter((item) => item.label && /^#[a-zA-Z][\w-]*$/.test(item.href)) : [];
  return <Shell {...props} data={data}>
    {!!nav?.length && <nav className={styles.nav}>{nav.map((item, i) => <a data-typography-role={props.typographyActive ? "body" : undefined} key={i} href={item.href}>{item.label}</a>)}</nav>}
    <div className={styles.header}>
      <div><Heading typographyActive={props.typographyActive} data={{ eyebrow: data.eyebrow }} /><div className={styles.identity}>
        {(data.name || data.avatar.url) && <div className={styles.avatar}>{data.avatar?.url ? <img src={data.avatar.url} alt={data.avatar.alt || ""} width={96} height={96} loading="lazy" decoding="async" /> : (data.name || "").trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join("")}</div>}
        <div>{data.name && <h1 data-typography-role={props.typographyActive ? "display" : undefined} className={styles.name}>{data.name}</h1>}{data.tagline && <p data-typography-role={props.typographyActive ? "body" : undefined} className={styles.tagline}>{data.tagline}</p>}</div>
      </div><Links items={data.links} /></div>
      {data.intro && <Prose typographyRole={props.typographyActive ? "body" : undefined} editorialLinks className={styles.intro}>{data.intro}</Prose>}
    </div>
  </Shell>;
}
function CardLink({ link, children }: { link: ReturnType<typeof editorialLink>; children: ReactNode }) {
  return link ? <a href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noreferrer" : undefined}>{children}</a> : <>{children}</>;
}
export function ProjectCardsSection(props: (Props<Base & { layout?: "grid" | "feed"; items?: {
  name: string; category?: string; description?: string; icon?: Image; monogram?: string;
  href?: string; meta?: string[]; media?: ProjectCardMedia[]; featured?: boolean;
  screenshot?: Image & { kind: "phone" | "web"; width?: number; height?: number }; links?: Link[];
}[] }>) & { typographyActive?: boolean }) {
  const raw = record(props.data);
  const data = { ...base(raw), items: Array.isArray(raw.items) ? raw.items.map((value) => {
    const item = record(value);
    const screenshot = record(item.screenshot);
    return { name: text(item.name), category: text(item.category), description: text(item.description),
      href: editorialLink(typeof item.href === "string" ? item.href : undefined, process.env.NEXTAUTH_URL || PLATFORM_ORIGIN, "project-card"),
      meta: Array.isArray(item.meta) ? item.meta.filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean).slice(0, 3) : undefined,
      featured: item.featured === true,
      media: Array.isArray(item.media) ? item.media.slice(0, 2).flatMap(value => { const parsed = projectCardMediaSchema.safeParse(value); return parsed.success ? [parsed.data] : []; }) : undefined,
      icon: image(item.icon), monogram: text(item.monogram), links: links(item.links),
      screenshot: { ...image(screenshot), kind: screenshot.kind === "phone" ? "phone" : "web",
        width: dimension(screenshot.width), height: dimension(screenshot.height) } };
  }).filter((item) => !!item.name) : [] };
  if (raw.layout === "feed") {
    const featured = data.items.findIndex(item => item.featured);
    const Title = data.heading ? "h3" : "h2";
    return <Shell {...props} data={data}><div className={styles.feed}>
      <Heading typographyActive={props.typographyActive} data={data} />
      {data.items.map((item, i) => {
        const meta = item.meta ?? (item.category ? [item.category] : []);
        const media: ProjectCardMedia[] = item.media ?? (editorialImageUrl(item.screenshot.url) ? [{ url: item.screenshot.url, alt: item.screenshot.alt || "" }] : []);
        return <article key={i} className={styles.feedCard} data-featured={i === featured || undefined}>
          {(item.icon.url || item.monogram || meta.length > 0) && <div className={styles.feedMeta} data-typography-role={props.typographyActive ? "caption" : undefined}>
            {editorialImageUrl(item.icon.url) ? <img className={styles.feedIcon} src={item.icon.url} alt={item.icon.alt || ""} width={28} height={28} loading={i === 0 ? "eager" : "lazy"} decoding="async" /> : item.monogram ? <span className={styles.feedIcon} aria-hidden="true">{Array.from(item.monogram).slice(0, 2).join("")}</span> : null}
            {meta.length > 0 && <p>{meta.join(" · ")}</p>}
          </div>}
          <Title className={styles.feedTitle} data-typography-role={props.typographyActive ? "heading" : undefined}><CardLink link={item.href}>{item.name}</CardLink></Title>
          {item.description && <p className={styles.feedDescription} data-typography-role={props.typographyActive ? "card" : undefined}><CardLink link={item.href}>{item.description}</CardLink></p>}
          {media.length > 0 && <div className={styles.feedMedia} data-count={media.length}>{media.map((tile, tileIndex) => {
            const link = editorialLink(tile.href, process.env.NEXTAUTH_URL || PLATFORM_ORIGIN, "project-card");
            const Tag = link ? "a" : "figure";
            return <Tag key={tileIndex} className={styles.feedTile} href={link?.href} target={link?.external ? "_blank" : undefined} rel={link?.external ? "noreferrer" : undefined}
              aria-label={link && !tile.alt.trim() && !tile.label?.trim() ? item.name : undefined}
              style={{ aspectRatio: (tile.aspect || "16:9").replace(":", " / ") }}>
              <img src={tile.url} alt={tile.alt} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
              {tile.label && <span className={styles.feedBadge}>{tile.label}</span>}
            </Tag>;
          })}</div>}
          <Links items={item.links} inline />
        </article>;
      })}
    </div></Shell>;
  }
  return <Shell {...props} data={data}><Heading typographyActive={props.typographyActive} data={data} />{!!data.items?.length && <ProjectReveal>{data.items.map((item, i) => <article key={i} className={styles.card}>
    <div className={styles.identity}>{item.icon?.url ? <img className={styles.icon} src={item.icon.url} alt={item.icon.alt || ""} width={64} height={64} loading="lazy" decoding="async" /> : item.monogram ? <span className={styles.icon}>{Array.from(item.monogram).slice(0, 2).join("")}</span> : null}
      <div>{(item.meta ? item.meta.length > 0 : item.category) && <p data-typography-role={props.typographyActive ? "caption" : undefined} className={styles.eyebrow}>{item.meta ? item.meta.join(" · ") : item.category}</p>}{data.heading ? <h3 data-typography-role={props.typographyActive ? "heading" : undefined} className={styles.projectName}><CardLink link={item.href}>{item.name}</CardLink></h3> : <h2 data-typography-role={props.typographyActive ? "heading" : undefined} className={styles.projectName}><CardLink link={item.href}>{item.name}</CardLink></h2>}</div>
    </div>
    {item.description && <p data-typography-role={props.typographyActive ? "card" : undefined} className={styles.description}><CardLink link={item.href}>{item.description}</CardLink></p>}
    {item.screenshot?.url && <ScreenshotFrame image={item.screenshot} />}
    <Links items={item.links} />
  </article>)}</ProjectReveal>}</Shell>;
}
export function EntriesSection(props: (Props<Base & { items?: { title: string; description?: string }[]; links?: Link[] }>) & { typographyActive?: boolean }) {
  const raw = record(props.data);
  const data = { ...base(raw), links: links(raw.links), items: Array.isArray(raw.items) ? raw.items.map((value) => {
    const item = record(value);
    return { title: text(item.title), description: text(item.description) };
  }).filter((item) => !!item.title) : [] };
  return <Shell {...props} data={data}><Heading typographyActive={props.typographyActive} data={data} />{data.intro && <Prose typographyRole={props.typographyActive ? "body" : undefined} editorialLinks className={styles.description}>{data.intro}</Prose>}
    {!!data.items?.length && <div className={styles.entries}>{data.items.map((item, i) => <article key={i}>{data.heading ? <h3 data-typography-role={props.typographyActive ? "heading" : undefined}>{item.title}</h3> : <h2 data-typography-role={props.typographyActive ? "heading" : undefined}>{item.title}</h2>}{item.description && <p data-typography-role={props.typographyActive ? "body" : undefined} className={styles.description}>{item.description}</p>}</article>)}</div>}
    <Links items={data.links} />
  </Shell>;
}
