"use client";

import { useSession } from "next-auth/react";
import { routing } from "@/i18n/routing";
import { AccountControls, type AccountLabels } from "./AccountControls";

export function PlatformAccountControls({ labels, compact, locale }: {
  labels: AccountLabels;
  compact: boolean;
  locale?: string;
}) {
  const { data: session } = useSession();
  return (
    <AccountControls
      user={session?.user}
      isAdmin={!!session && "role" in session && session.role === "ADMIN"}
      labels={labels}
      compact={compact}
      authPathPrefix={locale && locale !== routing.defaultLocale ? `/${locale}` : ""}
      light
    />
  );
}
