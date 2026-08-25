"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppNavigation } from "@/components/shell/app-navigation";
import { ResizableSidebar } from "@/components/shell/resizable-sidebar";
import { applyThemeBrand } from "@/lib/client/theme-brand";
import { themeDefinition, type ThemeId } from "@/lib/themes";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useStudyTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useStudyTheme must be used inside ThemeShell.");
  return context;
}

type ThemeShellProps = {
  children: React.ReactNode;
  course: string;
  csrfToken: string;
  displayName: string;
  highContrast: boolean;
  initialTheme: ThemeId;
  profilePic: boolean;
  reducedMotion: boolean;
};

export function ThemeShell({
  children,
  course,
  csrfToken,
  displayName,
  highContrast,
  initialTheme,
  profilePic,
  reducedMotion,
}: Readonly<ThemeShellProps>) {
  const [theme, updateTheme] = useState(initialTheme);
  const brandTheme = themeDefinition(theme);
  const setTheme = useCallback((nextTheme: ThemeId) => updateTheme(nextTheme), []);
  const context = useMemo(() => ({ theme, setTheme }), [setTheme, theme]);

  useEffect(() => {
    applyThemeBrand(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={context}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div
        className="app-shell"
        data-accessibility-contrast={highContrast ? "true" : "false"}
        data-reduced-motion={reducedMotion ? "true" : "false"}
        data-theme={theme}
      >
        <ResizableSidebar>
          <Link aria-label="Study Space dashboard" className="brand" href="/">
            <Image alt="Study Space" className="brand-logo" height={100} priority src={brandTheme.logo} width={160} />
          </Link>

          <AppNavigation />

          <div className="sidebar-account">
            <Link className="sidebar-profile" href="/profile">
              <span className="sidebar-avatar">
                {profilePic ? <img alt="" src="/api/profile/image" /> : displayName.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{displayName}</strong>
                <small>{course}</small>
              </span>
            </Link>
            <form action="/api/auth/logout" method="post">
              <input name="csrf_token" type="hidden" value={csrfToken} />
              <button aria-label="Sign out" className="sidebar-signout" title="Sign out" type="submit">
                <LogOut aria-hidden="true" size={19} />
              </button>
            </form>
          </div>
        </ResizableSidebar>

        <div className="app-content">
          <header className="mobile-app-header">
            <Link className="mobile-app-brand" href="/">
              <Image alt="" className="mobile-brand-logo" height={42} priority src={brandTheme.logo} width={42} />
              <strong>Study Space</strong>
            </Link>
            <div className="mobile-account-actions">
              <Link aria-label="Open profile" className="mobile-profile-link" href="/profile">
                {displayName.slice(0, 1).toUpperCase()}
              </Link>
              <form action="/api/auth/logout" method="post">
                <input name="csrf_token" type="hidden" value={csrfToken} />
                <button aria-label="Sign out" className="mobile-signout" title="Sign out" type="submit">
                  <LogOut aria-hidden="true" size={18} />
                </button>
              </form>
            </div>
          </header>
          <main className="main" id="main-content" tabIndex={-1}>{children}</main>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
