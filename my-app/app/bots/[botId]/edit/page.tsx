"use client";

import { Provider as JotaiProvider, useAtom } from "jotai";
import { ArrowLeft, ExternalLink, ListChecks, Loader2, Play, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/button";
import Skeleton from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  edgesAtom,
  isDirtyAtom,
  isSavingAtom,
  nodesAtom,
  selectedNodeIdAtom,
  workflowIdAtom,
  workflowNameAtom,
} from "@/components/workflow/store";
import { autoLayout } from "@/components/workflow/auto-layout";
import NodeConfigPanel from "@/components/workflow/node-config-panel";
import ActivationControl from "@/components/bots/activation-control";
import {
  ensureAddPlaceholders,
  fromKeeperhubGraph,
  toKeeperhubGraph,
} from "@/components/workflow/serialize";
import dynamic from "next/dynamic";

const WorkflowCanvas = dynamic(
  () => import("@/components/workflow/workflow-canvas"),
  { ssr: false },
);

export default function BotEditorPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  return (
    <JotaiProvider>
      <BotEditorInner params={params} />
    </JotaiProvider>
  );
}

function BotEditorInner({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [nodes, setNodes] = useAtom(nodesAtom);
  const [edges, setEdges] = useAtom(edgesAtom);
  const [, setSelectedId] = useAtom(selectedNodeIdAtom);
  const [dirty, setDirty] = useAtom(isDirtyAtom);
  const [saving, setSaving] = useAtom(isSavingAtom);
  const [workflowId, setWfId] = useAtom(workflowIdAtom);
  const [name, setName] = useAtom(workflowNameAtom);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [botStatus, setBotStatus] = useState("INACTIVE");

  useEffect(() => {
    if (status !== "authenticated") return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/bots/${botId}/workflow`);
        if (!res.ok) {
          throw new Error((await res.json())?.error || "Failed to load");
        }
        const json = await res.json();
        if (!alive) return;
        setWfId(json.bot?.keeperhubWorkflowId ?? null);
        setBotStatus(json.bot?.status ?? "INACTIVE");
        setName(json.name ?? json.bot?.name ?? "");

        const decoded = fromKeeperhubGraph(json.nodes, json.edges);
        const withAdds = ensureAddPlaceholders(decoded.nodes, decoded.edges);
        const laidOut = autoLayout(withAdds.nodes, withAdds.edges);
        setNodes(laidOut);
        setEdges(withAdds.edges);
        setSelectedId(null);
        setDirty(false);
      } catch (e) {
        toast({
          variant: "error",
          title: "Failed to load workflow",
          description: String(e),
        });
        router.push(`/bots/${botId}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, botId]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const payload = toKeeperhubGraph(nodes, edges);
      const res = await fetch(`/api/bots/${botId}/workflow`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || err?.message || "Save failed");
      }
      setDirty(false);
      toast({ variant: "success", title: "Workflow saved" });
    } catch (e) {
      toast({
        variant: "error",
        title: "Save failed",
        description: String(e),
      });
    } finally {
      setSaving(false);
    }
  }, [botId, nodes, edges, name, setSaving, setDirty, toast]);

  const runOnce = useCallback(async () => {
    if (!confirm("Run this published workflow on KeeperHub? Configured actions may spend real organization funds.")) return;
    setRunning(true);
    try {
      const res = await fetch(`/api/bots/${botId}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmLive: true }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || json?.message || "Run failed");
      }
      toast({ variant: "success", title: "Trigger fired" });
    } catch (e) {
      toast({
        variant: "error",
        title: "Run failed",
        description: String(e),
      });
    } finally {
      setRunning(false);
    }
  }, [botId, toast]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      // Cmd/Ctrl+S → save
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !saving) save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, saving, save]);

  if (status === "loading" || loading) {
    return (
      <div className="mx-auto max-w-7xl px-5 pt-6">
        <Skeleton className="h-14 w-full !rounded-full" />
        <Skeleton className="mt-4 h-[70vh] w-full" />
      </div>
    );
  }

  const iconBtn =
    "hidden h-9 items-center gap-1.5 rounded-full border border-white/12 px-3 text-xs text-[var(--c-dim)] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 sm:inline-flex";

  return (
    <div className="mx-auto flex h-[calc(100dvh-4.25rem)] w-full max-w-[1600px] flex-col px-3 pb-3 pt-3">
      <div className="c-panel flex flex-wrap items-center justify-between gap-2 !rounded-2xl px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            onClick={() => router.push(`/bots/${botId}`)}
            aria-label="Back to bot"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--c-dim)] hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            aria-label="Workflow name"
            placeholder="Workflow name"
            className="c-serif min-w-0 flex-1 rounded-xl bg-transparent px-2 py-1 text-2xl text-white outline-none hover:bg-white/5 focus:bg-white/5"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <span className="c-chip border-amber-300/40 text-amber-700">
              Unsaved <kbd className="opacity-70">⌘S</kbd>
            </span>
          )}
          <Link href={`/bots/${botId}/guided`} className={iconBtn}>
            <ListChecks className="h-3.5 w-3.5" /> Guided setup
          </Link>
          <Link href="/markets" target="_blank" className={iconBtn}>
            Markets <ExternalLink className="h-3 w-3" />
          </Link>
          <button onClick={runOnce} disabled={dirty || running || !workflowId} title={dirty ? "Save first" : "Fire the trigger once"} className={iconBtn}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Test run
          </button>
          <ActivationControl
            botId={botId}
            status={botStatus}
            workflowId={workflowId}
            disabled={dirty || saving}
            compact
            onChanged={(next) => {
              setBotStatus(next.status);
              setWfId(next.keeperhubWorkflowId);
            }}
          />
          <Button variant="primary" size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      <div className="c-panel mt-3 flex min-h-0 flex-1 overflow-hidden !rounded-2xl">
        <div className="flex-1 min-w-0">
          <WorkflowCanvas />
        </div>
        <NodeConfigPanel />
      </div>
    </div>
  );
}
