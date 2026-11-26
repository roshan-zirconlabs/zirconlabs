"use client";

import { Loader2, Pause, UploadCloud } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/button";
import { activationAction } from "@/lib/bot-activation";

type Props = {
  botId: string;
  status: string;
  disabled?: boolean;
  onChanged?: (next: { status: string; webhookUrl: string | null }) => void;
  compact?: boolean;
};

export default function ActivationControl({ botId, status, disabled = false, onChanged, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = activationAction(status);

  async function toggle() {
    if (busy || disabled) return;
    if (action.active && !window.confirm("Turn this bot on? In real-money mode it places orders from your trading wallet, within the limits you set.")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bots/${botId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: action.active }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "This bot could not be updated.");
      onChanged?.({ status: body.status, webhookUrl: body.webhookUrl ?? null });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "This bot could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <Button
        type="button"
        variant={action.active ? "primary" : "outline"}
        size={compact ? "sm" : "md"}
        onClick={() => void toggle()}
        disabled={busy || disabled}
        title={disabled ? "Save a strategy before changing activation." : action.description}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.active ? <UploadCloud className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        {busy ? "Updating…" : action.label}
      </Button>
      {!compact ? <p className="text-xs text-slate-500">{disabled ? "Save a strategy before turning this bot on." : action.description}</p> : null}
      {error ? <p role="alert" className="max-w-sm text-xs leading-5 text-rose-700">{error}</p> : null}
    </div>
  );
}
