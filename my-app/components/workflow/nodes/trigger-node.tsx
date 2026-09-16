"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { cn } from "@/lib/cn";
import { TRIGGER_ICONS } from "../icons";
import type { WorkflowNodeData } from "../types";

type TriggerNodeProps = NodeProps & { data?: WorkflowNodeData };

export const TriggerNode = memo(function TriggerNode({
  data,
  selected,
}: TriggerNodeProps) {
  if (!data) return null;
  const triggerType = (data.config?.triggerType as string) || "Manual";
  const Icon = TRIGGER_ICONS[triggerType] ?? TRIGGER_ICONS.Manual;
  const title = data.label || triggerType;

  return (
    <div
      className={cn(
        "relative flex min-h-[100px] w-[250px] items-center gap-3 rounded-2xl border bg-[#120f34] px-4 py-3 transition-colors",
        selected
          ? "border-[#f7a8cf] shadow-[0_0_0_3px_rgba(224,97,159,0.2),0_0_30px_-6px_rgba(224,97,159,0.5)]"
          : "border-[rgba(146,119,245,0.45)] hover:border-[rgba(247,168,207,0.6)]",
      )}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e0619f] to-[#5b3fc4] text-white">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="c-mono text-[10px] uppercase tracking-wider text-[var(--c-pink)]">
          Trigger
        </div>
        <div className="truncate text-sm font-semibold text-white">
          {title}
        </div>
        {data.description && (
          <div className="truncate text-[11px] text-[var(--c-dim)]">
            {data.description}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-[#0e1030] !bg-[#f7a8cf]"
      />
    </div>
  );
});
