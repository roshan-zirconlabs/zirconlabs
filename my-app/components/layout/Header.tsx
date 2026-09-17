"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { CreditCard, LogOut, Menu, X } from "lucide-react";
import { OrbitMark } from "@/components/brand/OrbitMark";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bots", label: "Bots" },
  { href: "/strategies", label: "Strategies" },
  { href: "/markets", label: "Markets" },
  { href: "/backtest", label: "Backtest" },
  { href: "/wallet", label: "Wallet" },
  { href: "/connections", label: "Connections" },
];

function AccountMenu({ name, image }: { name: string; image?: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/15 bg-gradient-to-br from-[#e0619f] to-[#5b3fc4] text-sm font-semibold text-white"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </button>
      {open && (
        <div role="menu" className="c-panel c-fade-in absolute right-0 top-12 w-56 bg-[rgba(10,12,36,0.96)] p-2">
          <p className="truncate px-3 py-2 text-sm text-[var(--c-dim)]">{name}</p>
          <Link
            role="menuitem"
            href="/billing"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5"
          >
            <CreditCard className="h-4 w-4 text-[var(--c-dim)]" /> Plan &amp; billing
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/5"
          >
            <LogOut className="h-4 w-4 text-[var(--c-dim)]" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const signedIn = !!session?.user?.id;

  if (pathname === "/") return null;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 rounded-full border border-white/10 bg-[rgba(8,10,32,0.78)] pl-4 pr-2 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-md">
        <Link href={signedIn ? "/dashboard" : "/"} className="flex shrink-0 items-center gap-2.5" aria-label="Zircon Labs home">
          <OrbitMark className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight">Zircon Labs</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`rounded-full px-3.5 py-2 text-sm transition-colors ${
                isActive(n.href) ? "bg-white/10 text-white" : "text-[var(--c-dim)] hover:bg-white/5 hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {signedIn ? (
            <AccountMenu name={session.user.name || session.user.email || "Account"} image={session.user.image} />
          ) : status !== "loading" ? (
            <Link href="/auth/sign-in" className="c-btn-primary c-btn-sm">
              Sign in
            </Link>
          ) : (
            <span className="c-skeleton h-9 w-20 rounded-full" />
          )}
          <button
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full text-white hover:bg-white/10 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="c-panel c-fade-in mx-auto mt-2 grid max-w-7xl grid-cols-2 gap-1 bg-[rgba(10,12,36,0.96)] p-2 lg:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`rounded-2xl px-4 py-3 text-[15px] ${isActive(n.href) ? "bg-white/10 text-white" : "text-[var(--c-dim)] hover:bg-white/5"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
