"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { memo } from "react";

type AddNodeData = { onClick?: () => void };

export const AddNode = memo(function AddNode({
  data,
}: NodeProps & { data?: AddNodeData }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={data?.onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && data?.onClick?.()}
      className="flex min-h-[100px] w-[250px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.02] text-[var(--c-dim)] transition-colors hover:border-[rgba(247,168,207,0.6)] hover:text-white"
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-[#0e1030] !bg-white/40"
      />
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white">
        <Plus className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium">Add step</span>
    </div>
  );
});
