"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionIcon } from "./icons";
import type { ActionDef } from "./registry";
import { useHostedCatalog } from "./hosted-catalog";

type Category = "all" | ActionDef["category"];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "logic", label: "Logic" },
  { id: "io", label: "Integrations" },
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

  const filtered = useMemo(() => {
    return (catalog.data ?? []).filter((a) => {
      if (category !== "all" && a.category !== category) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        a.label.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      );
    });
  }, [query, category, catalog.data]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a KeeperHub action"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,4,16,0.72)] p-4"
      onClick={onClose}
    >
      <div
        className="c-panel c-fade-in flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden bg-[rgba(12,14,40,0.98)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="c-serif text-2xl">Add a step</h2>
            <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-[var(--c-dim)] hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--c-faint)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actions or indicators..."
              aria-label="Search actions"
              className="c-input !pl-10"
            />
          </div>
          <div className="c-tabs mt-3 flex-wrap" role="group" aria-label="Action category">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className="c-tab !min-h-8 !px-3 !text-xs"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {catalog.isLoading && <p role="status" className="p-4 text-sm text-[var(--c-dim)]">Loading KeeperHub actions…</p>}
          {catalog.error && <div role="alert" className="p-4 text-sm text-rose-700">KeeperHub actions are temporarily unavailable. <button onClick={() => catalog.refetch()} className="underline">Retry</button></div>}
          {catalog.isLoading || catalog.error ? null : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--c-faint)]">
              No actions match your search.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((a) => {
                return (
                  <button
                    key={a.id}
                    onClick={() => onPick(a)}
                    className="flex items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-[rgba(146,119,245,0.3)] to-[rgba(224,97,159,0.2)] text-white">
                      <ActionIcon actionType={a.actionType} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="c-mono text-[10px] uppercase tracking-wider text-[var(--c-faint)]">
                        {a.integrationType}
                      </div>
                      <div className="text-sm font-medium text-white">
                        {a.label}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[var(--c-dim)]">
                        {a.description}
                      </div>
                    </div>
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
