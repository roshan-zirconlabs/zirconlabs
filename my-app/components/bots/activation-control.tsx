"use client";

import { Loader2, Pause, UploadCloud } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/button";
import { activationAction } from "@/lib/bot-activation";

type Props = {
  botId: string;
  status: string;
  workflowId: string | null;
  disabled?: boolean;
  onChanged?: (next: { status: string; keeperhubWorkflowId: string | null; editorUrl: string | null; webhookUrl: string | null }) => void;
  compact?: boolean;
};

export default function ActivationControl({ botId, status, workflowId, disabled = false, onChanged, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = activationAction(status, workflowId);

  async function toggle() {
    if (busy || disabled) return;
    if (action.active && !window.confirm("Publish and activate this workflow? Its KeeperHub actions may spend real organization funds when triggered.")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bots/${botId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: action.active }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "KeeperHub could not update this workflow.");
      onChanged?.({
        status: body.status,
        keeperhubWorkflowId: body.keeperhubWorkflowId ?? workflowId,
        editorUrl: body.editorUrl ?? null,
        webhookUrl: body.webhookUrl ?? null,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "KeeperHub could not update this workflow.");
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
        title={disabled ? "Save the workflow before changing activation." : action.description}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.active ? <UploadCloud className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        {busy ? "Updating…" : action.label}
      </Button>
      {!compact ? <p className="text-xs text-slate-500">{disabled ? "Save your workflow before publishing or pausing it." : action.description}</p> : null}
      {error ? <p role="alert" className="max-w-sm text-xs leading-5 text-rose-700">{error}</p> : null}
    </div>
  );
}
