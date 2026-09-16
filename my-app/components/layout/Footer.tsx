"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrbitMark } from "@/components/brand/OrbitMark";

const LINKS = [
  ["Dashboard", "/dashboard"],
  ["Markets", "/markets"],
  ["Backtest", "/backtest"],
  ["Plans", "/billing"],
];

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/" || pathname.endsWith("/edit")) return null;

  return (
    <footer className="mt-16 border-t border-white/10 bg-[rgba(5,7,26,0.6)]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-7 sm:flex-row">
        <div className="flex items-center gap-2.5 text-sm text-[var(--c-faint)]">
          <OrbitMark className="h-6 w-6" />
          <span>© {new Date().getFullYear()} Zircon Labs · Built on KeeperHub</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="text-[var(--c-dim)] transition-colors hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
