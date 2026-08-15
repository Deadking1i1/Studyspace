"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileText,
  Gauge,
  Headphones,
  Layers,
  Lightbulb,
  MessageSquare,
  Settings,
  Trophy,
} from "lucide-react";

const navigationItems = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/autopilot", label: "Autopilot", icon: Lightbulb },
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

function isCurrentPath(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/dashboard" || pathname === "/hub";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="nav-list" aria-label="Main navigation">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const active = isCurrentPath(pathname, item.href);
        return (
          <Link aria-current={active ? "page" : undefined} className={`nav-link${active ? " active" : ""}`} href={item.href} key={item.href}>
            <Icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
