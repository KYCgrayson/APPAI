"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb } from "./Breadcrumb";

const labels: Record<string, string> = {
  pages: "Pages", publisher: "Publisher", settings: "API Keys", tools: "Tools",
  analytics: "Analytics", apps: "Apps", "universal-apps": "Universal Releases",
  users: "Users", feedback: "Feedback", usage: "Tool Usage",
};

export function ManagementBreadcrumb({ area, homeHref = "/" }: { area: "dashboard" | "admin"; homeHref?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== area) return null;
  return <Breadcrumb label="Breadcrumb" className={`mx-auto px-6 py-2 ${area === "admin" ? "max-w-7xl" : "max-w-6xl"}`} items={[
    { name: "AppAI", href: homeHref },
    { name: area === "admin" ? "Admin" : "Dashboard", href: `/${area}` },
    ...segments.slice(1).map((segment, index) => ({ name: labels[segment] ?? segment, href: `/${segments.slice(0, index + 2).join("/")}` })),
  ]} />;
}
