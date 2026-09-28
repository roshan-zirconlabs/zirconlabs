"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type Mode = "PAPER" | "LIVE";

/** fetch that throws the server's readable error message. */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  // An order that reached the book but didn't fill comes back 409 with the
  // order attached (no `error`); callers read its status.
  if (!res.ok && (body.error || res.status !== 409)) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export type Me = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  mode: Mode;
  paperCashUsd: number;
  live: { available: boolean; account: boolean; enabled: boolean; paused: boolean };
  telegram: { configured: boolean; linked: boolean };
};

export function useMe(enabled = true) {
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/api/me"), enabled, staleTime: 15_000 });
}

export function useSetMode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (mode: Mode) => api<Me>("/api/me", { method: "PATCH", json: { mode } }),
    onSuccess: (me) => {
      client.setQueryData(["me"], me);
      // Everything shown depends on the mode.
      client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    },
  });
}

/** 0.42 → "42¢"; keeps a decimal for sub-cent prices. */
export function cents(price: number | null | undefined): string {
  if (price === null || price === undefined || !Number.isFinite(price)) return "—";
  const c = price * 100;
  return `${c < 1 || c % 1 !== 0 ? c.toFixed(1) : c.toFixed(0)}¢`;
}

export function money(n: number | null | undefined, signed = false): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : signed && n > 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function until(iso: string | null | undefined): string {
  if (!iso) return "no end date";
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (s <= 0) return "ended";
  if (s < 3600) return `ends in ${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `ends in ${Math.round(s / 3600)}h`;
  return `ends in ${Math.round(s / 86400)}d`;
}

export const newRequestId = () => crypto.randomUUID();
