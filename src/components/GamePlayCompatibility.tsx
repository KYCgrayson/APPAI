"use client";

import { useEffect } from "react";
import { needsGamePlayRedirect } from "@/lib/game-play-compat";

export function GamePlayCompatibility({ slug, playHref, label }: {
  slug: string;
  playHref: string;
  label: string;
}) {
  useEffect(() => {
    const { search, hash } = window.location;
    if (needsGamePlayRedirect(slug, search, hash)) {
      window.location.replace(`/games/${slug}/play${search}${hash}`);
    }
  }, [slug]);

  return <noscript><a href={playHref}>{label}</a></noscript>;
}
