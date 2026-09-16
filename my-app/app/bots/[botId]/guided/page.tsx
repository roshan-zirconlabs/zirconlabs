"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import StrategyBuilder from "@/components/bots/strategy-builder";
import ActivationControl from "@/components/bots/activation-control";
import { Notice, PageHeader, PageShell } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";

export default function GuidedSetupPage({ params }: { params: Promise<{ botId: string }> }) {
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

  useEffect(() => {
    if (status === "unauthenticated") router.push(`/auth/sign-in?callbackUrl=/bots/${botId}/guided`);
  }, [status, router, botId]);

  const bot = query.data ? { ...query.data.bot, ...(statusOverride ?? {}) } : null;
  const hasStrategy = Boolean(query.data?.strategy);

  if (query.error) {
    return (
      <PageShell width="medium">
        <Notice tone="error">{(query.error as Error).message}</Notice>
      </PageShell>
    );
  }
  if (!bot) {
    return (
      <PageShell width="medium">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="mt-8 h-96" />
      </PageShell>
    );
  }

  return (
    <PageShell width="medium">
      <PageHeader
        back={{ href: `/bots/${botId}`, label: bot.name }}
        eyebrow="Guided setup"
        title="Plot the"
        accent="trajectory."
        description="Five quick choices define what this bot does. You can change any of them later."
        actions={
          <>
            <Link href={`/bots/${botId}/edit`} className="c-btn-ghost c-btn-sm">
              <SlidersHorizontal className="h-4 w-4" /> Advanced canvas
            </Link>
            <ActivationControl
              botId={botId}
              status={bot.status}
              workflowId={bot.keeperhubWorkflowId}
              disabled={!hasStrategy}
              compact
              onChanged={(next) => setStatusOverride({ status: next.status, keeperhubWorkflowId: next.keeperhubWorkflowId })}
            />
          </>
        }
      />

      {!hasStrategy && (
        <div className="mb-6">
          <Notice tone="warning">Save a strategy below before you can turn this bot on.</Notice>
        </div>
      )}

      <StrategyBuilder botId={botId} onSaved={() => void query.refetch()} />
    </PageShell>
  );
}
