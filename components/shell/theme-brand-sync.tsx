"use client";

import { useEffect } from "react";
import { applyThemeBrand } from "@/lib/client/theme-brand";
import type { ThemeId } from "@/lib/themes";

export function ThemeBrandSync({ theme }: Readonly<{ theme: ThemeId }>) {
  useEffect(() => {
    applyThemeBrand(theme);
  }, [theme]);

  return null;
}
