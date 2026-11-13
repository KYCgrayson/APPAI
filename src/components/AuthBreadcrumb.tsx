"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Breadcrumb } from "./Breadcrumb";

/** Fits in the auth card's existing 32px top padding without adding height. */
export function AuthBreadcrumb({ page }: { page: "signIn" | "signOut" | "deviceAuth" }) {
  const t = useTranslations("breadcrumbs");
  return <Breadcrumb label={t("label")} variant="platform" LinkComponent={Link}
    className="absolute inset-x-8 top-0 h-7 text-left [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" items={[
      { name: "AppAI", href: "/" },
      { name: t(page), href: page === "signIn" ? "/login" : page === "signOut" ? "/logout" : "/auth/device" },
    ]} />;
}
