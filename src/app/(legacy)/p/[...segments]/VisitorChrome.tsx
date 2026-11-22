"use client";

import { useEffect } from "react";
import { localizeHostedChrome } from "@/lib/hosted-chrome-client";

/** No DOM output, inline script, request headers, cookies or storage. */
export function VisitorChrome({ locale }: { locale: string }) {
  useEffect(() => {
    const scope = document.querySelector<HTMLElement>("[data-chrome-locale]");
    if (scope) return localizeHostedChrome(scope, navigator.languages);
  }, [locale]);
  return null;
}
