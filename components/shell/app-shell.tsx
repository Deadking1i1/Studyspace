import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock3,
  Gauge,
  Headphones,
  Layers,
  MessageSquare,
  Trophy,
  Bell,
  FileText,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/notes", label: "Notes", icon: BookOpen },
  { href: "/materials", label: "Materials", icon: FileText },
  { href: "/tasks", label: "Planner", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/timer", label: "Timer", icon: Clock3 },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/community", label: "Community", icon: MessageSquare },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/notifications", label: "Updates", icon: Bell },
  { href: "/spotify", label: "Spotify", icon: Headphones },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <div className="brand-mark">SS</div>
          <div>
            <strong>Study Space</strong>
            <span>Student command center</span>
          </div>
        </Link>

        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="nav-link" href={item.href} key={item.href}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
