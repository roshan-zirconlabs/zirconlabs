"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Rocket, X } from "lucide-react";

export default function CreateBotDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "The bot could not be created.");
      const id = json.id || json.bot?.id;
      await client.invalidateQueries({ queryKey: ["bots"] });
      if (id) router.push(`/bots/${id}`);
      else onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The bot could not be created.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,4,16,0.72)] p-4" onMouseDown={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-bot-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="c-panel c-fade-in relative w-full max-w-md bg-[rgba(12,14,40,0.98)] p-7"
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[var(--c-dim)] hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#e0619f] to-[#5b3fc4]">
          <Rocket className="h-5 w-5 text-white" />
        </span>
        <h2 id="create-bot-title" className="c-serif mt-5 text-3xl text-white">
          Launch a new bot
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--c-dim)]">
          Give it a name. Next you&rsquo;ll choose its signal and limits — it starts in practice mode.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="bot-name" className="c-label">
              Bot name
            </label>
            <input
              ref={inputRef}
              id="bot-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BTC 15m momentum"
              className="c-input"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={busy} className="c-btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={busy || !name.trim()} className="c-btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {busy ? "Creating…" : "Create bot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
