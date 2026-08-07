"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/auth";

const NAV_ITEMS = [
  { href: "/dashboard/queue", label: "Live Queue" },
  { href: "/dashboard/databases", label: "Song Databases" },
  { href: "/dashboard/history", label: "Request History" },
  { href: "/dashboard/payments", label: "Tips & Payments" },
  { href: "/dashboard/stats", label: "Statistics" },
  { href: "/dashboard/search-analytics", label: "Search Analytics" },
  { href: "/dashboard/qr", label: "QR Code" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardHeader() {
  const pathname = usePathname();
  if (pathname === "/dashboard/login" || pathname === "/dashboard/set-password") return null;

  return (
    <header className="border-b border-border bg-surface px-4 py-3 flex items-center gap-4">
      <span className="font-semibold text-lg shrink-0">Dashboard</span>
      {/* Horizontally scrollable on narrow screens — 8 sections don't fit one row
          on a phone, and this is safer than hiding items behind a menu since
          Live Queue is left open mid-gig and needs to stay reachable in one tap. */}
      <nav className="flex gap-1 text-sm text-foreground-muted flex-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 hover:text-foreground ${
              pathname === item.href ? "bg-background text-foreground" : ""
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <form action={signOut} className="shrink-0">
        <button type="submit" className="text-sm text-foreground-muted hover:text-foreground px-2 py-2 -mx-2 -my-2">
          Log out
        </button>
      </form>
    </header>
  );
}
