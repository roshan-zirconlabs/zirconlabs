"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, Menu, X } from "lucide-react";
import { OrbitMark } from "@/components/brand/OrbitMark";

const LINKS = [
  { href: "#mission", label: "How it works" },
  { href: "#system", label: "Features" },
  { href: "#shields", label: "Safety" },
  { href: "/markets", label: "Markets" },
];

export default function LandingNav() {
  const { data: session } = useSession();
  const signedIn = !!session?.user?.id;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        Skip to content
      </a>
      <div
        className={`mx-auto flex h-14 max-w-5xl items-center justify-between rounded-full pl-5 pr-2 transition-all duration-300 ${
          scrolled ? "c-glass bg-[rgba(8,10,32,0.72)] backdrop-blur-md" : "c-glass bg-[rgba(8,10,32,0.35)] backdrop-blur-md"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="Zircon Labs home">
          <OrbitMark className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight">Zircon Labs</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm text-[var(--c-dim)] transition-colors hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {!signedIn && (
            <Link href="/auth/sign-in" className="hidden rounded-full px-4 py-2 text-sm text-[var(--c-dim)] transition-colors hover:text-white sm:block">
              Sign in
            </Link>
          )}
          <Link href={signedIn ? "/dashboard" : "/auth/sign-up"} className="c-btn-primary !min-h-10 !px-4 !text-sm">
            {signedIn ? "Open console" : "Launch a bot"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-10 w-10 place-items-center rounded-full text-white hover:bg-white/10 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="landing-mobile-nav" aria-label="Mobile" className="c-glass mx-auto mt-2 grid max-w-5xl gap-1 rounded-3xl bg-[rgba(8,10,32,0.95)] p-3 md:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-[15px] text-[var(--c-dim)] hover:bg-white/5 hover:text-white">
              {l.label}
            </a>
          ))}
          {!signedIn && (
            <Link href="/auth/sign-in" className="rounded-2xl px-4 py-3 text-[15px] text-[var(--c-dim)] hover:bg-white/5 hover:text-white">
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
