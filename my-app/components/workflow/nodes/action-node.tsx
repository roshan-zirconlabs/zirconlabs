"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Box } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/cn";
import { ACTION_ICONS } from "../icons";
import { findActionByConfig } from "../registry";
import type { WorkflowNodeData } from "../types";

type ActionNodeProps = NodeProps & { data?: WorkflowNodeData };

export const ActionNode = memo(function ActionNode({
  data,
  selected,
}: ActionNodeProps) {
  if (!data) return null;
  const integrationType = data.config?.integrationType as string | undefined;
  const actionType = data.config?.actionType as string | undefined;
  const def =
    integrationType && actionType
      ? findActionByConfig(integrationType, actionType)
      : undefined;

  const Icon = def ? ACTION_ICONS[def.iconName] : Box;
  const title = data.label || def?.label || actionType || "Choose action";
  const description = data.description || def?.description || (integrationType ? `${integrationType} action` : "Click to configure");
  const isUnconfigured = !def;
  const isPaper = integrationType === "zlabs-polymarket";

  return (
    <div
      className={cn(
        "relative flex min-h-[100px] w-[250px] items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xs transition-all",
        selected
          ? "border-purple-600 ring-3 ring-purple-500/20 shadow-md shadow-purple-500/10"
          : "border-purple-100 hover:border-purple-300 hover:shadow-md",
        isUnconfigured && "border-dashed border-slate-300 bg-slate-50/50",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-purple-600"
      />
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-lg shadow-xs",
          isUnconfigured
            ? "bg-slate-100 text-slate-400"
            : "bg-purple-50 text-purple-700 border border-purple-100",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">
          {isPaper ? "Paper demo" : def?.category ?? integrationType ?? "Action"}
        </div>
        <div className="truncate text-xs font-bold text-slate-900">
          {title}
        </div>
        <div className="truncate text-[11px] text-slate-500">
          {description}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-purple-600"
      />
    </div>
  );
});
