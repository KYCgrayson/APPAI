import { hostedVisitorChromeLabels, resolveHostedChromeLocale } from "./hosted-chrome-labels.ts";

/** Runs only after hydration. Keep cached HTML and publisher content untouched. */
export function localizeHostedChrome(scope: HTMLElement, languages: readonly string[]) {
  const pageLocale = scope.dataset.chromeLocale!;
  const locale = resolveHostedChromeLocale(languages, pageLocale);
  if (locale === pageLocale) return;
  const labels = hostedVisitorChromeLabels(locale);
  const selector = "[data-chrome-label],[data-chrome-aria-label],[data-chrome-title]";
  const translate = () => {
    // A translated landmark's accessible name must not change pronunciation
    // of the publisher titles or account name nested inside it.
    for (const element of scope.querySelectorAll<HTMLElement>("[data-chrome-content]")) {
      if (element.lang !== pageLocale) element.lang = pageLocale;
    }
    for (const element of scope.querySelectorAll<HTMLElement>(selector)) {
      for (const [marker, attribute] of [["data-chrome-label", null], ["data-chrome-aria-label", "aria-label"], ["data-chrome-title", "title"]] as const) {
        const key = element.getAttribute(marker);
        if (!key || !Object.hasOwn(labels, key)) continue;
        const text = labels[key as keyof typeof labels] + (element.dataset.chromeSuffix ?? "");
        if (attribute) {
          if (element.getAttribute(attribute) !== text) element.setAttribute(attribute, text);
        } else {
          // Retain icons, spans, React's text nodes and comment boundaries.
          // Composite labels (official site + host) have multiple text nodes.
          const nodes = Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
          nodes.forEach((node, index) => {
            const value = index === 0 ? text : "";
            if (node.textContent !== value) node.textContent = value;
          });
        }
      }
      if (element.lang !== locale) element.lang = locale;
    }
  };
  translate();
  // Drawers and streamed/client-navigation content can arrive after mount.
  const observer = new MutationObserver(translate);
  observer.observe(scope, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ["data-chrome-label", "data-chrome-aria-label", "data-chrome-title", "aria-label", "title"] });
  return () => observer.disconnect();
}
