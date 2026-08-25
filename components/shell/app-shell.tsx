import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfiles, userSettings } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { getCsrfToken } from "@/lib/auth/csrf";
import { ThemeShell } from "@/components/shell/theme-shell";
import { normalizeTheme } from "@/lib/themes";

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  const [settings] = user
    ? await db
        .select({
          highContrast: userSettings.highContrast,
          reducedMotion: userSettings.reducedMotion,
          theme: userSettings.theme,
        })
        .from(userSettings)
        .where(eq(userSettings.userId, user.id))
        .limit(1)
    : [];
  const [profile] = user
    ? await db
        .select({ displayName: userProfiles.displayName, course: userProfiles.course, profilePic: userProfiles.profilePic })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1)
    : [];
  const theme = normalizeTheme(settings?.theme);
  const displayName = profile?.displayName || user?.username || "Student";
  const csrfToken = user ? await getCsrfToken() : "";

  return (
    <ThemeShell
      course={profile?.course || "Student workspace"}
      csrfToken={csrfToken}
      displayName={displayName}
      highContrast={settings?.highContrast ?? false}
      initialTheme={theme}
      profilePic={Boolean(profile?.profilePic)}
      reducedMotion={settings?.reducedMotion ?? false}
    >
      {children}
    </ThemeShell>
  );
}
