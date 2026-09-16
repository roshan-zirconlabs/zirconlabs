"use client";

import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export type BotSummary = {
  id: string;
  name: string;
  status: string;
  keeperhubWorkflowId: string | null;
  editorUrl: string | null;
  webhookUrl: string | null;
  strategy: { mode?: "paper" | "live"; source?: "schedule" | "webhook"; asset?: string; timeframe?: string } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { trades: number };
};

export function describeBot(bot: BotSummary) {
  const s = bot.strategy;
  if (!s) return "Custom workflow";
  return [s.asset, s.timeframe, s.source === "webhook" ? "TradingView alert" : "Scheduled"].filter(Boolean).join(" · ");
}

export type BotPatch = Partial<Pick<BotSummary, "status" | "keeperhubWorkflowId" | "editorUrl" | "webhookUrl">>;

export function useBots() {
  const { status } = useSession();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["bots"],
    enabled: status === "authenticated",
    staleTime: 15_000,
    queryFn: async (): Promise<BotSummary[]> => {
      const res = await fetch("/api/bots");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Your bots could not be loaded.");
      return json.bots ?? [];
    },
  });

  const patchBot = useCallback(
    (id: string, patch: BotPatch) =>
      client.setQueryData<BotSummary[]>(["bots"], (bots) => bots?.map((b) => (b.id === id ? { ...b, ...patch } : b))),
    [client],
  );

  return { ...query, bots: query.data ?? [], patchBot, sessionStatus: status };
}

export type WalletSummary = { hasAccount: boolean; liveEnabled: boolean; balance: number | null; configured: boolean };

export function useWalletSummary() {
  const { status } = useSession();
  return useQuery({
    queryKey: ["wallet-summary"],
    enabled: status === "authenticated",
    staleTime: 30_000,
    queryFn: async (): Promise<WalletSummary> => {
      const res = await fetch("/api/wallet/account");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Wallet status unavailable.");
      if (!json.account) return { hasAccount: false, liveEnabled: false, balance: null, configured: Boolean(json.configured) };
      const ready = await fetch("/api/polymarket/readiness").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      return {
        hasAccount: true,
        liveEnabled: Boolean(json.account.liveEnabled),
        balance: ready ? Number(ready.balance ?? 0) : null,
        configured: Boolean(json.configured),
      };
    },
  });
}
