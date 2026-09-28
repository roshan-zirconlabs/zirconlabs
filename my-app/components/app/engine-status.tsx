"use client";

import { useQuery } from "@tanstack/react-query";
import { Notice } from "@/components/ui/page";
import { ago } from "@/lib/client";

/**
 * Automations only protect you if the engine is running. This says so plainly
 * instead of letting a stop-loss look armed when nothing is watching it.
 */
export default function EngineStatus({ hasActive }: { hasActive: boolean }) {
  const { data } = useQuery({
    queryKey: ["engine"],
    queryFn: async () => {
      const health = (await (await fetch("/api/engine")).json()) as { engineLastRunAt: string | null };
      const last = health.engineLastRunAt ? new Date(health.engineLastRunAt).getTime() : 0;
      return { ...health, stale: Date.now() - last > 3 * 60_000 };
    },
    refetchInterval: 30_000,
    enabled: hasActive,
  });
  if (!hasActive || !data) return null;
  if (!data.stale) {
    return <p className="flex items-center gap-2 text-xs text-[var(--c-dim)]"><span className="c-pulse h-2 w-2 rounded-full bg-[var(--c-up)]" /> Watching the market — last check {ago(data.engineLastRunAt)}</p>;
  }
  return (
    <Notice tone="warning">
      The automation engine hasn&rsquo;t run {data.engineLastRunAt ? `since ${ago(data.engineLastRunAt)}` : "yet"}, so your automations aren&rsquo;t being watched right now. They&rsquo;ll resume as soon as it does.
    </Notice>
  );
}
