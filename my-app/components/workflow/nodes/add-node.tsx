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
      onClick={data?.onClick}
      className="flex min-h-[100px] w-[250px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/40 text-purple-700 transition-all hover:border-purple-400 hover:bg-purple-100/60 hover:shadow-xs"
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-purple-300"
      />
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-purple-700">
        <Plus className="h-4 w-4" />
      </div>
      <span className="text-xs font-semibold">Add step</span>
    </div>
  );
});
