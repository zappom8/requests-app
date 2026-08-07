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
    <header className="border-b border-border bg-surface px-4 py-3 flex items-center gap-6">
      <span className="font-semibold text-lg">Dashboard</span>
      <nav className="flex gap-4 text-sm text-foreground-muted flex-1">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="hover:text-foreground">
            {item.label}
          </Link>
        ))}
      </nav>
      <form action={signOut}>
        <button type="submit" className="text-sm text-foreground-muted hover:text-foreground">
          Log out
        </button>
      </form>
    </header>
  );
}
