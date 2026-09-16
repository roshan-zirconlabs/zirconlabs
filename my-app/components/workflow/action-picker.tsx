"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { ACTION_ICONS } from "./icons";
import { ACTIONS, type ActionDef } from "./registry";
import { useHostedCatalog } from "./hosted-catalog";

type Category = "all" | "keeperhub" | "polymarket" | "logic" | "io";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "keeperhub", label: "KeeperHub" },
  { id: "polymarket", label: "Polymarket" },
  { id: "logic", label: "Logic" },
  { id: "io", label: "I/O" },
];

export default function ActionPicker({
  onPick,
  onClose,
}: {
  onPick: (def: ActionDef) => void;
  onClose: () => void;
  onClick?: () => void;
}) {
  const [query, setQuery] = useState("");
  const catalog = useHostedCatalog();
  const [category, setCategory] = useState<Category>("all");

  const actions = useMemo(() => {
    const hosted = catalog.data ?? [];
    const seen = new Set<string>();
    return [...hosted, ...ACTIONS.map((a) => ({ ...a, source: a.source ?? "zircon", availability: a.availability ?? "paper" } as ActionDef))].filter((action) => {
      if (seen.has(action.id)) return false;
      seen.add(action.id);
      return true;
    });
  }, [catalog.data]);

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      if (category === "keeperhub" && a.source !== "keeperhub") return false;
      if (category === "polymarket" && a.category !== "polymarket") return false;
      if (category === "logic" && a.integrationType !== "system" && !a.id.startsWith("code/")) return false;
      if (category === "io" && (a.category !== "io" || a.source !== "keeperhub")) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        a.label.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      );
    });
  }, [query, category, actions]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a KeeperHub action"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-2xl shadow-purple-900/10 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-purple-100 p-4 bg-purple-50/40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actions or indicators..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-purple-400 focus:bg-white transition"
            />
          </div>
          <div className="mt-2.5 flex gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                  category === c.id
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-purple-50 hover:text-purple-700",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {catalog.isLoading && <p role="status" className="p-4 text-sm">Loading hosted actions…</p>}
          {catalog.error && <div role="alert" className="p-4 text-sm text-red-700">KeeperHub actions are temporarily unavailable; paper actions remain available. <button onClick={() => catalog.refetch()} className="underline">Retry</button></div>}
          <button onClick={onClose} className="px-3 py-2 text-sm text-slate-600">Close</button>
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No actions match your search.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((a) => {
                const Icon = ACTION_ICONS[a.iconName];
                return (
                  <button
                    key={a.id}
                    onClick={() => onPick(a)}
                    className="flex items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-purple-50/70"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-50 border border-purple-100 text-purple-700">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                        {a.integrationType}
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        {a.label}
                      </div>
                      <div className="truncate text-[11px] text-slate-500 mt-0.5">
                        {a.description}
                      </div>
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider",
                      a.availability === "paper"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-purple-200 bg-purple-50/50 text-purple-700",
                    )}>
                      {a.availability === "paper" ? "Paper demo" : a.source === "keeperhub" ? "KeeperHub" : a.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
