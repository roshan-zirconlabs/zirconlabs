"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp } from "lucide-react";
import { PageHeader, PageShell, EmptyState, Notice } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";
import { api, cents, until } from "@/lib/client";

type Outcome = { label: string; tokenId: string; price: number | null };
type Market = { slug: string; question: string; endDate: string | null; volume24h: number; outcomes: Outcome[] };
type Group = { slug: string; title: string; image: string | null; volume24h: number; markets: Market[] };

const compact = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`);

export default function MarketsPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["markets", query],
    queryFn: () => api<{ events: Group[] }>(`/api/markets?q=${encodeURIComponent(query)}`),
    staleTime: 20_000,
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Markets"
        title="Find a market"
        description="Every open Polymarket market. Pick one to trade it, protect a position, or let an automation buy at your price."
      />

      <label className="relative block max-w-2xl">
        <span className="sr-only">Search markets</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--c-faint)]" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search — e.g. bitcoin, election, Fed, Champions League"
          className="c-input !min-h-12 !rounded-full !pl-11"
          autoFocus
        />
      </label>

      <p className="mt-6 flex items-center gap-2 text-sm text-[var(--c-dim)]">
        {query ? <>Results for “{query}”</> : <><TrendingUp className="h-4 w-4" /> Trending by 24h volume</>}
      </p>

      <div className="mt-4 space-y-4">
        {isLoading && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        {error && (
          <Notice tone="error">
            {(error as Error).message}{" "}
            <button onClick={() => refetch()} className="underline">Retry</button>
          </Notice>
        )}
        {data && data.events.length === 0 && (
          <EmptyState title="No open markets found" body="Try a broader word, or clear the search to see what's trending." />
        )}
        {data?.events.map((g) => (
          <section key={g.slug} className="c-panel p-5">
            <div className="flex items-start gap-3">
              {g.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.image} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" loading="lazy" />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-white">{g.title}</h2>
                <p className="text-xs text-[var(--c-faint)]">{compact(g.volume24h)} traded in 24h</p>
              </div>
            </div>
            <ul className="mt-3 divide-y divide-white/5">
              {g.markets.slice(0, 6).map((m) => (
                <li key={m.slug}>
                  <Link href={`/markets/${m.slug}`} className="-mx-2 flex flex-col gap-2 rounded-xl px-2 py-3 transition-colors hover:bg-white/5 sm:flex-row sm:items-center sm:gap-4">
                    <span className="w-full min-w-0 flex-1">
                      <span className="block text-sm text-white sm:truncate">{m.question}</span>
                      <span className="text-xs text-[var(--c-faint)]">{until(m.endDate)}</span>
                    </span>
                    <span className="flex max-w-full shrink-0 flex-wrap gap-1.5">
                      {m.outcomes.slice(0, 2).map((o, i) => (
                        <span key={o.tokenId} className={`c-chip !text-xs ${i === 0 ? "border-emerald-300/30 text-[var(--c-up)]" : "border-rose-300/30 text-[var(--c-down)]"}`}>
                          {o.label} {cents(o.price)}
                        </span>
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {g.markets.length > 6 && <p className="mt-2 text-xs text-[var(--c-faint)]">+{g.markets.length - 6} more markets in this event — search to narrow down.</p>}
          </section>
        ))}
      </div>
    </PageShell>
  );
}
