export const themeDefinitions = [
  { id: "rain", name: "Rain Focus", description: "Rainy city nights", image: "/assets/themes/rain.webp" },
  { id: "cyan", name: "Cyan Focus", description: "Clean cyan atmosphere", image: "/assets/themes/cyan.webp" },
  { id: "ocean", name: "Deep Ocean", description: "Quiet beneath the surface", image: "/assets/themes/ocean.webp" },
  { id: "forest", name: "Forest Green", description: "Misty forest retreat", image: "/assets/themes/forest.webp" },
  { id: "aurora", name: "Aurora Fusion", description: "Northern lights", image: "/assets/themes/aurora.webp" },
  { id: "purple", name: "Cosmic Purple", description: "Deep space nebula", image: "/assets/themes/purple.webp" },
  { id: "light", name: "Minimal Light", description: "Bright and airy", image: "/assets/themes/light.webp" },
  { id: "high-contrast", name: "High Contrast", description: "Maximum readability", image: "/assets/themes/high-contrast.webp" },
] as const;

export type ThemeId = (typeof themeDefinitions)[number]["id"];

export type ThemeActionState = {
  message: string;
  status: "idle" | "saved" | "error";
  theme: ThemeId;
};

const themeIds = new Set<string>(themeDefinitions.map((theme) => theme.id));

export function normalizeTheme(theme?: string | null): ThemeId {
  if (theme === "dark") return "rain";
  return theme && themeIds.has(theme) ? (theme as ThemeId) : "rain";
}
