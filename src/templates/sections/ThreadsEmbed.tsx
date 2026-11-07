"use client";

import { useEffect, useRef } from "react";

/** Meta's official blockquote + embed.js format; load only near the viewport.
 * https://developers.facebook.com/docs/threads/embeds/
 */
export function ThreadsEmbed({ url }: { url: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    let script: HTMLScriptElement | undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting) || script) return;
      script = document.createElement("script");
      script.src = "https://www.threads.com/embed.js";
      script.async = true;
      node.appendChild(script);
      observer.disconnect();
    }, { rootMargin: "200px" });
    observer.observe(node);
    return () => { observer.disconnect(); script?.remove(); };
  }, [url]);
  return <div ref={container} key={url}>
    <blockquote className="text-post-media" data-text-post-permalink={url} data-text-post-version="0">
      <a href={url} target="_blank" rel="noopener noreferrer">View on Threads</a>
    </blockquote>
  </div>;
}
