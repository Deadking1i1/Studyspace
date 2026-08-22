"use client";

import { themeDefinition, type ThemeId } from "@/lib/themes";

export function applyThemeBrand(theme: ThemeId) {
  const faviconPath = themeDefinition(theme).favicon;
  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.append(favicon);
  }
  favicon.href = faviconPath;
  favicon.type = "image/png";
}
