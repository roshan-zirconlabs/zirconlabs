"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Webhook,
  SlidersHorizontal,
} from "lucide-react";
import ExecutionAuditTrail from "@/components/bots/execution-audit-trail";
import ActivationControl from "@/components/bots/activation-control";

type BotResponse = {
  id: string;
  name: string;
  status: string;
  keeperhubWorkflowId: string | null;
  editorUrl: string | null;
  webhookUrl: string | null;
  strategy: { mode?: "paper" | "live"; source?: "schedule" | "webhook" } | null;
  _count?: { trades: number };
};

export default function BotDetailPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = use(params);
  const { status } = useSession();
  const router = useRouter();

  const [bot, setBot] = useState<BotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bots/${botId}`);
      if (!res.ok) {
        router.push("/bots");
        return;
      }
      setBot(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [botId, router]);

  useEffect(() => {
    if (status === "authenticated") load();
    else if (status === "unauthenticated") router.push("/auth/sign-in");
  }, [status, load, router]);

  async function deleteBot() {
    if (
      !confirm(
        "Delete this bot? Its linked KeeperHub workflow will also be removed.",
      )
    )
      return;
    const res = await fetch(`/api/bots/${botId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard");
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !bot) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="h-8 w-48 bg-purple-100/70 rounded-xl animate-pulse mb-4" />
        <div className="h-44 w-full bg-purple-50/60 rounded-2xl animate-pulse border border-purple-100" />
      </div>
    );
  }

  const { editorUrl, webhookUrl } = bot;
  const mode = bot.strategy?.mode ?? null;
  const isWebhookSourced = bot.strategy?.source === "webhook";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-100 pb-5">
        <div className="space-y-1">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-900 transition mb-2 font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {bot.name}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                bot.status === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {bot.status}
            </span>
            {mode && (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                mode === "live" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-purple-50 text-purple-700 border-purple-200"
              }`}>
                {mode === "live" ? "LIVE · real money" : "PRACTICE"}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-slate-500">
            KeeperHub Workflow ID:{" "}
            <span className="text-slate-800 font-semibold">
              {bot.keeperhubWorkflowId ?? "—"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <ActivationControl
            botId={botId}
            status={bot.status}
            workflowId={bot.keeperhubWorkflowId}
            compact
            onChanged={(next) => setBot((current) => current ? { ...current, ...next } : current)}
          />
          <Link
            href={`/bots/${botId}/edit`}
            className="cosmic-btn-primary inline-flex items-center gap-2 text-xs font-semibold px-4 py-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Edit strategy
          </Link>
          {editorUrl ? (
            <a
              href={editorUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-purple-50 hover:border-purple-300 transition shadow-xs"
            >
              <ExternalLink className="h-3.5 w-3.5 text-purple-600" />
              Open in KH
            </a>
          ) : null}
          <button
            type="button"
            onClick={deleteBot}
            className="p-2 rounded-xl border border-rose-200 bg-white text-rose-500 hover:bg-rose-50 hover:border-rose-300 transition shadow-xs cursor-pointer"
            title="Delete Bot"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Alert URL — only meaningful for a bot whose trigger IS a webhook */}
      {isWebhookSourced && (
        <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Webhook className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-semibold text-slate-900">Your TradingView alert URL</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Paste this into your TradingView alert&rsquo;s webhook field, with message body <code className="rounded bg-slate-100 px-1 py-0.5">{"{\"action\": \"{{strategy.order.action}}\"}"}</code>.
            {!bot.keeperhubWorkflowId && " It only exists once this bot is published — turn it on to generate it."}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-xl border border-purple-100 bg-purple-50/50 p-2.5 text-xs font-mono text-purple-700 truncate select-all">
              {webhookUrl || "Not published yet"}
            </code>
            {webhookUrl && (
              <button
                type="button"
                onClick={() => copy(webhookUrl)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-purple-50 hover:border-purple-300 transition shadow-xs cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-purple-600" />
                    Copy
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Trades, stats, and every run — including sat-outs and failures */}
      <ExecutionAuditTrail botId={botId} />
    </div>
  );
}
