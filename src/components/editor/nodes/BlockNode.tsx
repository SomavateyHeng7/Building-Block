"use client";

import { memo, useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useDiagramStore } from "@/lib/diagram/store";
import type { BlockNodeData } from "@/lib/diagram/types";

export type BlockFlowNode = Node<BlockNodeData, "block">;

function BlockNodeComponent({ id, data, selected }: NodeProps<BlockFlowNode>) {
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  const selectNode = useDiagramStore((state) => state.selectNode);
  const legend = useDiagramStore((state) => state.diagram.legend);
  const [editing, setEditing] = useState(false);

  const color = legend.find((entry) => entry.key === data.colorKey)?.color ?? "#9ca3af";

  return (
    <div
      className="flex h-full w-full items-center justify-center rounded border text-center text-xs font-medium"
      style={{
        backgroundColor: color,
        borderColor: selected ? "#2563eb" : "rgba(0,0,0,0.25)",
        color: textColorFor(color),
      }}
      onClick={(event) => {
        event.stopPropagation();
        selectNode(id);
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <NodeResizer minWidth={80} minHeight={32} isVisible={selected} />
      {editing ? (
        <input
          autoFocus
          className="nodrag nopan w-full bg-transparent px-1 text-center outline-none"
          defaultValue={data.label}
          onBlur={(event) => {
            updateNodeLabel(id, event.target.value || "Untitled");
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      ) : (
        <span className="px-1">{data.label}</span>
      )}
    </div>
  );
}

function textColorFor(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#111827";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#f9fafb";
}

export default memo(BlockNodeComponent);
