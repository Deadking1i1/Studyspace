"use client";

import { themeDefinition, type ThemeId } from "@/lib/themes";

export function applyThemeBrand(theme: ThemeId) {
  const faviconPath = themeDefinition(theme).favicon;
  let favicon = document.querySelector<HTMLLinkElement>("#study-space-favicon");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.id = "study-space-favicon";
    favicon.rel = "icon";
    document.head.append(favicon);
  }
  favicon.href = `${faviconPath}?theme=${encodeURIComponent(theme)}`;
  favicon.type = "image/png";
}
