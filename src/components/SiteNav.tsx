"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENUS = [
  { href: "/", label: "推荐" },
  { href: "/series", label: "短剧" },
  { href: "/studio", label: "Studio" },
];

export default function SiteNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="sticky top-0 z-20 border-b border-zinc-800/80 bg-[#0b0b10]/90 backdrop-blur">
      <div className="flex h-12 w-full items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="text-sm font-bold tracking-widest text-accent">
          COMICLAW
        </Link>
        <nav className="flex h-full items-center gap-1">
          {MENUS.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`relative flex h-full items-center px-3 text-sm font-medium transition-colors ${
                isActive(m.href) ? "text-accent" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m.label}
              {isActive(m.href) && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />
              )}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
