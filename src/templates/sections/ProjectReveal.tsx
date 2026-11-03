"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ProjectReveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !root.current) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          observer.unobserve(entry.target);
          continue;
        }
        entry.target.animate(
          [{ opacity: 0.55, transform: "translateY(18px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 650, easing: "cubic-bezier(.2,.7,.3,1)" },
        );
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08 });
    for (const card of root.current.children) observer.observe(card);
    return () => observer.disconnect();
  }, []);
  return <div ref={root} className="grid border-t border-[var(--rule)] md:grid-cols-2">{children}</div>;
}
