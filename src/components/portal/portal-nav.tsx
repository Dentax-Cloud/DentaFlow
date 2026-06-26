"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { logoutFromPortal } from "@/app/portal/[slug]/actions";

export function PortalNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const links = [
    { href: `/portal/${slug}/dashboard`, label: "Home", icon: "🏠" },
    { href: `/portal/${slug}/appointments`, label: "Visits", icon: "📅" },
    { href: `/portal/${slug}/invoices`, label: "Invoices", icon: "🧾" },
    { href: `/portal/${slug}/consent`, label: "Forms", icon: "📋" },
    { href: `/portal/${slug}/profile`, label: "Profile", icon: "👤" },
  ];

  function handleLogout() {
    startTransition(async () => {
      await logoutFromPortal(slug);
      router.push(`/portal/${slug}/login`);
      router.refresh();
    });
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-white md:hidden">
      <div className="flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-1 flex-col items-center py-2 text-xs transition-colors ${
              pathname === link.href ? "text-blue-600" : "text-muted-foreground"
            }`}
          >
            <span className="text-lg">{link.icon}</span>
            <span className="mt-0.5">{link.label}</span>
          </Link>
        ))}
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className="sr-only"
      >
        Logout
      </button>
    </nav>
  );
}

export function PortalDesktopNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const links = [
    { href: `/portal/${slug}/dashboard`, label: "Home" },
    { href: `/portal/${slug}/appointments`, label: "Appointments" },
    { href: `/portal/${slug}/book`, label: "Book" },
    { href: `/portal/${slug}/invoices`, label: "Invoices" },
    { href: `/portal/${slug}/consent`, label: "Forms" },
    { href: `/portal/${slug}/education`, label: "Health info" },
    { href: `/portal/${slug}/profile`, label: "Profile" },
  ];

  function handleLogout() {
    startTransition(async () => {
      await logoutFromPortal(slug);
      router.push(`/portal/${slug}/login`);
      router.refresh();
    });
  }

  return (
    <div className="mb-6 hidden flex-wrap items-center gap-2 md:flex">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            pathname === link.href
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          {link.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className="ml-auto text-sm text-red-600 hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}
