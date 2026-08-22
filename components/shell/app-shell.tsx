import Link from "next/link";
import Image from "next/image";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfiles, userSettings } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { AppNavigation } from "@/components/shell/app-navigation";
import { ResizableSidebar } from "@/components/shell/resizable-sidebar";
import { ThemeBrandSync } from "@/components/shell/theme-brand-sync";
import { normalizeTheme, themeDefinition } from "@/lib/themes";

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
  const brandTheme = themeDefinition(theme);
  const displayName = profile?.displayName || user?.username || "Student";

  return (
    <div
      className="app-shell"
      data-accessibility-contrast={settings?.highContrast ? "true" : "false"}
      data-reduced-motion={settings?.reducedMotion ? "true" : "false"}
      data-theme={theme}
      suppressHydrationWarning
    >
      <ThemeBrandSync theme={theme} />
      <ResizableSidebar>
        <Link className="brand" href="/">
          <Image alt="Study Space" className="brand-logo" height={100} priority src={brandTheme.logo} width={160} />
        </Link>

        <AppNavigation />

        <Link className="sidebar-profile" href="/profile">
          <span className="sidebar-avatar">
            {profile?.profilePic ? <img alt="" src="/api/profile/image" /> : displayName.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{displayName}</strong>
            <small>{profile?.course || "Student workspace"}</small>
          </span>
        </Link>
      </ResizableSidebar>

      <section className="app-content">
        <header className="mobile-app-header">
          <Link className="mobile-app-brand" href="/">
            <Image alt="" className="mobile-brand-logo" height={42} priority src={brandTheme.logo} width={42} />
            <strong>Study Space</strong>
          </Link>
          <Link className="mobile-profile-link" href="/profile" aria-label="Open profile">
            {displayName.slice(0, 1).toUpperCase()}
          </Link>
        </header>
        <main className="main">{children}</main>
      </section>
    </div>
  );
}
