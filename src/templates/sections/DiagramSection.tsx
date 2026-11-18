import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { normalizeDiagramData, type DiagramItem } from "@/lib/diagram";
import { editorialLink } from "@/lib/hosted-editorial-links";
import { PLATFORM_ORIGIN } from "@/lib/platform-identity";
import { proseThemeVariables } from "@/lib/prose-theme";
import { diagramStrings } from "./diagram-strings";
import styles from "./diagram.module.css";

function DiagramLink({ label, url }: { label: string; url: string }) {
  const link = editorialLink(url, PLATFORM_ORIGIN, "project-card");
  return link ? <a href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noreferrer" : undefined}>{label}</a> : null;
}

function Diagram({ item, locale }: { item: DiagramItem; locale: string }) {
  if (item.kind === "compare") return (
    <ul role="list" className={styles.columns} style={{ "--diagram-columns": item.columns.length } as CSSProperties}>
      {item.columns.map((column, index) => <li className={styles.box} key={index}>
        <h4>{column.label}</h4>
        <ul className={styles.points}>{column.points.map((point, i) => <li key={i}>{point}</li>)}</ul>
      </li>)}
    </ul>
  );
  if (item.kind === "layers") return (
    <ol role="list" className={styles.layers}>
      {item.layers.map((layer, index) => <li className={styles.box} data-focus={item.focus === index ? "true" : undefined} aria-current={item.focus === index ? "true" : undefined} key={index}>
        <h4>{layer.label}</h4>{layer.detail && <p>{layer.detail}</p>}
      </li>)}
    </ol>
  );
  const cycle = item.kind === "cycle";
  const topCount = Math.ceil(item.steps.length / 2);
  return <>
    {cycle && <p className={styles.srOnly}>{diagramStrings(locale).repeats}</p>}
    <ol role="list" className={cycle ? styles.cycle : styles.steps} style={{ "--diagram-columns": cycle ? topCount : item.steps.length } as CSSProperties}>
      {item.steps.map((step, index) => {
        const last = index === item.steps.length - 1;
        const top = index < topCount;
        const position = cycle ? { gridRow: top ? 1 : 2, gridColumn: top ? index + 1 : last ? `1 / span ${item.steps.length % 2 ? 2 : 1}` : topCount - (index - topCount), ...(last && item.steps.length % 2 ? { "--diagram-return-x": "calc((100% - 3rem) / 4 - .5rem)" } : {}) } : undefined;
        const direction = !cycle ? "right" : last ? "up" : index === topCount - 1 ? "down" : top ? "right" : "left";
        return <li className={styles.box} key={index} style={position}>
          <span className={styles.number} aria-hidden="true">{index + 1}</span>
          <h4>{step.label}</h4>{step.detail && <p>{step.detail}</p>}
          {(!last || cycle) && <span className={styles.arrow} data-direction={direction} aria-hidden="true" />}
        </li>;
      })}
    </ol>
  </>;
}

/** Server-rendered text and CSS only; all four diagrams stand alone without media. */
export function DiagramSection({ data, themeColor, darkMode = false, locale = "en", typographyActive = false }: {
  data: unknown; themeColor: string; darkMode?: boolean; locale?: string; typographyActive?: boolean;
}) {
  const normalized = normalizeDiagramData(data);
  if (!normalized) return null;
  const colors = proseThemeVariables(themeColor) ?? proseThemeVariables("#2563eb")!;
  const style = { ...colors, "--diagram-accent": colors[darkMode ? "--page-theme-link-dark" : "--page-theme-link-light"] } as CSSProperties;
  return <section className={styles.section} data-diagram="true" data-dark={darkMode ? "true" : undefined} style={style}>
    <div className={styles.inner}>
      {normalized.heading && <h2 data-typography-role={typographyActive ? "heading" : undefined}>{normalized.heading}</h2>}
      {normalized.subheading && <p>{normalized.subheading}</p>}
      {normalized.items.map((item, index) => <article className={styles.item} data-kind={item.kind} key={index}>
        <h3 data-typography-role={typographyActive ? "card" : undefined}>{item.icon && <Icon name={item.icon} size={24} />}{item.title}</h3>
        <Diagram item={item} locale={locale} />
        {item.takeaway && <p className={styles.takeaway}>{item.takeaway}</p>}
        {item.sources && <ul className={styles.sources}>{item.sources.map((source, i) => <li key={i}><DiagramLink {...source} /></li>)}</ul>}
        {item.link && <p className={styles.link}><DiagramLink {...item.link} /></p>}
      </article>)}
    </div>
  </section>;
}
