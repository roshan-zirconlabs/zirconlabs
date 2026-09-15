"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import StrategyBuilder from "@/components/bots/strategy-builder";
import ActivationControl from "@/components/bots/activation-control";

export default function BotEditorPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = use(params);
  const { status } = useSession();
  const router = useRouter();

  const [statusOverride, setStatusOverride] = useState<{ status: string; keeperhubWorkflowId: string | null } | null>(null);

  const query = useQuery({
    queryKey: ["bot-strategy", botId],
    enabled: status === "authenticated",
    queryFn: async () => {
      const res = await fetch(`/api/bots/${botId}/strategy`);
      if (!res.ok) throw new Error("This bot could not be loaded.");
      return res.json() as Promise<{
        bot: { name: string; status: string; keeperhubWorkflowId: string | null };
        strategy: unknown | null;
      }>;
    },
  });

  if (status === "unauthenticated") router.push(`/auth/sign-in?callbackUrl=/bots/${botId}/edit`);

  const bot = query.data ? { ...query.data.bot, ...(statusOverride ?? {}) } : null;
  const hasStrategy = Boolean(query.data?.strategy);
  const load = () => { void query.refetch(); };

  if (query.error) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><p role="alert" className="text-sm text-rose-700">{(query.error as Error).message}</p></div>;
  }
  if (!bot) return <div className="mx-auto max-w-3xl px-4 py-10"><div className="h-64 animate-pulse rounded-2xl bg-purple-50" /></div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-100 pb-5">
        <div className="flex items-center gap-3">
          <Link href={`/bots/${botId}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{bot.name}</h1>
            <p className="text-xs text-slate-500">Set up what this bot does. You can change it any time.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/bots/${botId}/advanced`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Advanced
          </Link>
          <ActivationControl
            botId={botId}
            status={bot.status}
            workflowId={bot.keeperhubWorkflowId}
            disabled={!hasStrategy}
            compact
            onChanged={next => setStatusOverride({ status: next.status, keeperhubWorkflowId: next.keeperhubWorkflowId })}
          />
        </div>
      </div>

      {!hasStrategy && (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Save a strategy below before you can turn this bot on.
        </p>
      )}

      <div className="mt-6">
        <StrategyBuilder botId={botId} onSaved={load} />
      </div>
    </div>
  );
}
