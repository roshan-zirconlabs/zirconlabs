"use client";

import TradingViewChart from "@/components/charts/tradingview-chart";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Check, Copy, ListChecks, SlidersHorizontal, Trash2, Webhook } from "lucide-react";
import ExecutionAuditTrail from "@/components/bots/execution-audit-trail";
import TrackRecordCard from "@/components/bots/track-record-card";
import ActivationControl from "@/components/bots/activation-control";
import BotAvatar from "@/components/bots/bot-avatar";
import { BotStatusBadge, PageShell, StatusBadge } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";

type BotResponse = {
  id: string;
  name: string;
  status: string;
  webhookUrl: string | null;
  strategy: { mode?: "paper" | "live"; source?: "schedule" | "webhook"; asset?: string; timeframe?: string } | null;
  _count?: { trades: number };
};

export default function BotDetailPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const client = useQueryClient();

  const [patch, setPatch] = useState<Partial<BotResponse>>({});
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ["bot", botId],
    enabled: status === "authenticated",
    retry: false,
    queryFn: async (): Promise<BotResponse> => {
      const res = await fetch(`/api/bots/${botId}`);
      if (!res.ok) throw new Error("Bot not found");
      return res.json();
    },
  });
  const bot = query.data ? { ...query.data, ...patch } : null;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/sign-in");
    else if (query.isError) router.push("/bots");
  }, [status, query.isError, router]);

  async function deleteBot() {
    if (!confirm("Delete this bot and its history?")) return;
    const res = await fetch(`/api/bots/${botId}`, { method: "DELETE" });
    if (res.ok) {
      await client.invalidateQueries({ queryKey: ["bots"] });
      router.push("/bots");
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!bot) {
    return (
      <PageShell>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-6 h-16 w-2/3" />
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="mt-6 h-80" />
      </PageShell>
    );
  }

  const { webhookUrl } = bot;
  const mode = bot.strategy?.mode ?? null;
  const isWebhookSourced = bot.strategy?.source === "webhook";

  return (
    <PageShell>
      <Link href="/bots" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-dim)] hover:text-white">
        ← All bots
      </Link>

      <div className="c-fade-in mt-6 mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-center gap-5">
          <BotAvatar id={bot.id} active={bot.status === "ACTIVE"} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <BotStatusBadge status={bot.status} />
              {mode && <StatusBadge tone={mode === "live" ? "live" : "practice"}>{mode === "live" ? "Live · real money" : "Practice"}</StatusBadge>}
            </div>
            <h1 className="c-serif mt-3 break-words text-[clamp(2.25rem,5vw,3.75rem)] leading-none text-white">{bot.name}</h1>
            <p className="c-mono mt-2 truncate text-xs text-[var(--c-faint)]">
              {isWebhookSourced ? "Runs when your alert arrives" : bot.strategy ? "Runs on its market schedule" : "No strategy yet"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <ActivationControl
            botId={botId}
            status={bot.status}
            compact
            onChanged={(next) => {
              setPatch((current) => ({ ...current, ...next }));
              void client.invalidateQueries({ queryKey: ["bots"] });
            }}
          />
          <Link href={`/bots/${botId}/guided`} className="c-btn-ghost c-btn-sm">
            <ListChecks className="h-4 w-4" /> Guided setup
          </Link>
          <Link href={`/bots/${botId}/edit`} className="c-btn-ghost c-btn-sm">
            <SlidersHorizontal className="h-4 w-4" /> Visual editor
          </Link>
          <button type="button" onClick={deleteBot} aria-label="Delete bot" title="Delete bot" className="c-btn-danger c-btn-sm !px-2.5">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isWebhookSourced && (
        <section className="c-panel mb-6 p-6">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-[var(--c-pink)]" />
            <h2 className="font-semibold">Your TradingView alert URL</h2>
          </div>
          <p className="mt-2 text-sm text-[var(--c-dim)]">
            Paste this into your TradingView alert&rsquo;s webhook field. For an alert on a strategy, set the message to{" "}
            <code className="c-mono rounded-md bg-white/10 px-1.5 py-0.5 text-xs">{'{"action": "{{strategy.order.action}}"}'}</code>;
            for an indicator alert, write <code className="c-mono rounded-md bg-white/10 px-1.5 py-0.5 text-xs">buy</code> or{" "}
            <code className="c-mono rounded-md bg-white/10 px-1.5 py-0.5 text-xs">sell</code>.
            {bot.status !== "ACTIVE" && " Alerts are ignored while the bot is paused."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <code className="c-mono min-w-0 flex-1 select-all truncate rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-[var(--c-pink)]">
              {webhookUrl || "Save an alert strategy to get your URL"}
            </code>
            {webhookUrl && (
              <button type="button" onClick={() => copy(webhookUrl)} className="c-btn-ghost">
                {copied ? <Check className="h-4 w-4 text-[var(--c-up)]" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        </section>
      )}

      {bot.strategy?.asset && (
        <section className="c-panel mb-6 p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{bot.strategy.asset} chart · {bot.strategy.timeframe}</h2>
            <p className="text-xs text-[var(--c-faint)]">Add your own indicators. Polymarket settles these markets on Chainlink&rsquo;s price.</p>
          </div>
          <TradingViewChart asset={bot.strategy.asset} timeframe={bot.strategy.timeframe ?? "15m"} />
        </section>
      )}

      <TrackRecordCard botId={botId} />

      <ExecutionAuditTrail botId={botId} />
    </PageShell>
  );
}
