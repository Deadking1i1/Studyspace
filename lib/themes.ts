export const themeDefinitions = [
  { id: "rain", name: "Rain Focus", description: "Rainy city nights", image: "/assets/themes/rain.webp", logo: "/assets/brand/rain.png", favicon: "/assets/brand/favicon-rain.png" },
  { id: "cyan", name: "Cyan Focus", description: "Clean cyan atmosphere", image: "/assets/themes/cyan.webp", logo: "/assets/brand/cyan.png", favicon: "/assets/brand/favicon-cyan.png" },
  { id: "ocean", name: "Deep Ocean", description: "Quiet beneath the surface", image: "/assets/themes/ocean.webp", logo: "/assets/brand/ocean.png", favicon: "/assets/brand/favicon-ocean.png" },
  { id: "forest", name: "Forest Green", description: "Misty forest retreat", image: "/assets/themes/forest.webp", logo: "/assets/brand/forest.png", favicon: "/assets/brand/favicon-forest.png" },
  { id: "aurora", name: "Aurora Fusion", description: "Northern lights", image: "/assets/themes/aurora.webp", logo: "/assets/brand/aurora.png", favicon: "/assets/brand/favicon-aurora.png" },
  { id: "purple", name: "Cosmic Purple", description: "Deep space nebula", image: "/assets/themes/purple.webp", logo: "/assets/brand/purple.png", favicon: "/assets/brand/favicon-purple.png" },
] as const;

export type ThemeId = (typeof themeDefinitions)[number]["id"];

export type ThemeActionState = {
  message: string;
  status: "idle" | "saved" | "error";
  theme: ThemeId;
};

const themeIds = new Set<string>(themeDefinitions.map((theme) => theme.id));

export function normalizeTheme(theme?: string | null): ThemeId {
  if (theme === "dark" || theme === "light" || theme === "high-contrast") return "rain";
  return theme && themeIds.has(theme) ? (theme as ThemeId) : "rain";
}

export function themeDefinition(theme?: string | null) {
  const normalizedTheme = normalizeTheme(theme);
  return themeDefinitions.find((candidate) => candidate.id === normalizedTheme) ?? themeDefinitions[0];
}
