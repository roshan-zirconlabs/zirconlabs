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
        "relative flex min-h-[100px] w-[250px] items-center gap-3 rounded-2xl border bg-[#0e1030] px-4 py-3 transition-colors",
        selected
          ? "border-[#f7a8cf] shadow-[0_0_0_3px_rgba(224,97,159,0.2),0_0_30px_-6px_rgba(224,97,159,0.5)]"
          : "border-white/12 hover:border-white/30",
        isUnconfigured && "border-dashed border-white/25",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-[#0e1030] !bg-[#f7a8cf]"
      />
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          isUnconfigured
            ? "bg-white/5 text-[var(--c-faint)]"
            : "border border-white/10 bg-gradient-to-br from-[rgba(146,119,245,0.35)] to-[rgba(224,97,159,0.25)] text-white",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="c-mono text-[10px] uppercase tracking-wider text-[var(--c-pink)]">
          {isPaper ? "Paper demo" : def?.category ?? integrationType ?? "Action"}
        </div>
        <div className="truncate text-sm font-semibold text-white">
          {title}
        </div>
        <div className="truncate text-[11px] text-[var(--c-dim)]">
          {description}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-[#0e1030] !bg-[#f7a8cf]"
      />
    </div>
  );
});
