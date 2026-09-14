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
        "relative flex min-h-[100px] w-[250px] items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xs transition-all",
        selected
          ? "border-violet-600 ring-3 ring-violet-500/20 shadow-md shadow-violet-500/10"
          : "border-purple-200/90 hover:border-purple-400 hover:shadow-md",
      )}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 text-white shadow-xs">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">
          Trigger
        </div>
        <div className="truncate text-xs font-bold text-slate-900">
          {title}
        </div>
        {data.description && (
          <div className="truncate text-[11px] text-slate-500">
            {data.description}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-violet-600"
      />
    </div>
  );
});
