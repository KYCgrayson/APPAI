"use client";

import { useEffect, type ComponentProps } from "react";
import { gamePlayCompatibilityHref, gamePlaySearch } from "@/lib/game-play-compat";

export function GamePlayCompatibility({ slug, playHref, label }: {
  slug: string;
  playHref: string;
  label: string;
}) {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const target = gamePlayCompatibilityHref(pathname, search, hash);
    if (target) window.location.replace(target);
  }, [slug]);

  return <noscript><a href={playHref}>{label}</a></noscript>;
}

/** Read legacy language queries only when Play is clicked, keeping SSR static. */
export function GamePlayLink({ slug, href, ...props }: ComponentProps<"a"> & { slug: string; href: string }) {
  return <a {...props} href={href} onClick={(event) => {
    const query = new URLSearchParams(window.location.search);
    const target = new URL(href, window.location.origin);
    // The existing Play URL supplies a puzzle selector and the route language.
    // An explicit language query overrides just the corresponding language.
    const explicit = query.get("locale") ?? query.get("lang");
    if (explicit !== null) {
      const language = new URLSearchParams(gamePlaySearch(slug, "", explicit));
      language.forEach((value, name) => target.searchParams.set(name, value));
      event.currentTarget.href = `${target.pathname}${target.search}`;
    }
    props.onClick?.(event);
  }} />;
}
