"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Menu, X } from "lucide-react";
const NAV = [
  { href: "/dashboard", label: "Overview" }, { href: "/bots", label: "Bots" },
  { href: "/markets", label: "Markets" }, { href: "/backtest", label: "Backtest" },
  { href: "/wallet", label: "Wallet" }, { href: "/connections", label: "Connections" },
];
export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname(); const [open, setOpen] = useState(false);
  const signedIn = !!session?.user.id;
  return <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-3">Skip to content</a>
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
      <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Zircon Labs home">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600 font-mono text-xs font-bold text-white">ZL</span>
        <span className="text-sm font-semibold tracking-tight">Zircon Labs</span>
      </Link>
      <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
        {NAV.map(n => <Link key={n.href} href={n.href} aria-current={pathname.startsWith(n.href) ? "page" : undefined} className={`rounded-md px-3 py-2 text-sm transition-colors ${pathname.startsWith(n.href) ? "bg-violet-50 font-medium text-violet-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>{n.label}</Link>)}
      </nav>
      <div className="flex items-center gap-3">
        {signedIn ? <><Link href="/billing" className="hidden text-sm text-slate-600 sm:block">Plan</Link><button onClick={() => signOut()} className="rounded-md border border-slate-200 px-3 py-2 text-sm">Sign out</button></> : <Link href="/auth/sign-in" className="cosmic-btn-primary px-4 py-2 text-sm">Sign in</Link>}
        <button aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(v => !v)} className="rounded-lg p-2 lg:hidden">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
    </div>
    {open && <nav id="mobile-navigation" aria-label="Mobile navigation" className="grid grid-cols-2 gap-1 border-t border-slate-100 px-4 py-3 lg:hidden">{NAV.map(n => <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={pathname.startsWith(n.href) ? "page" : undefined} className="rounded-lg px-3 py-3 text-sm text-slate-700 hover:bg-violet-50">{n.label}</Link>)}</nav>}
  </header>;
}
