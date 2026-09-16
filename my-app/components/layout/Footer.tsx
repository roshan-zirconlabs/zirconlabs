"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-purple-100 bg-white/70 backdrop-blur-md py-6">
      <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white font-bold font-mono text-[10px] shadow-xs">
            ZL
          </div>
          <span className="font-bold tracking-tight text-slate-800 text-xs font-mono">
            ZIRCON LABS
          </span>
          <span className="text-[11px] text-slate-400">
            &copy; {new Date().getFullYear()} · Autonomous Polymarket Workflows via KeeperHub
          </span>
        </div>

        <nav className="flex items-center gap-5 text-xs text-slate-500">
          <Link href="/dashboard" className="hover:text-purple-700 transition">
            Dashboard
          </Link>
          <Link href="/bots" className="hover:text-purple-700 transition">
            Bots
          </Link>
          <Link href="/markets" className="hover:text-purple-700 transition">
            Markets
          </Link>
          <Link href="/billing" className="hover:text-purple-700 transition">
            Billing
          </Link>
        </nav>
      </div>
    </footer>
  );
}
