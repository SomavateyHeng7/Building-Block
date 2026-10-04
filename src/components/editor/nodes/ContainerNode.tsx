"use client";

import { memo, useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useDiagramStore } from "@/lib/diagram/store";
import type { ContainerNodeData } from "@/lib/diagram/types";

export type ContainerFlowNode = Node<ContainerNodeData, "container">;

function ContainerNodeComponent({ id, data, selected }: NodeProps<ContainerFlowNode>) {
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  const selectNode = useDiagramStore((state) => state.selectNode);
  const legend = useDiagramStore((state) => state.diagram.legend);
  const [editing, setEditing] = useState(false);

  const accentColor = legend.find((entry) => entry.key === data.colorKey)?.color;

  return (
    <div
      className="flex h-full w-full flex-col rounded-md border-2 bg-white/60 dark:bg-black/30"
      style={{ borderColor: accentColor ?? "#9ca3af" }}
      onClick={() => selectNode(id)}
    >
      <NodeResizer minWidth={200} minHeight={120} isVisible={selected} />
      <div
        className="flex items-center justify-between rounded-t px-2 py-1 text-xs font-semibold text-zinc-800"
        style={{ backgroundColor: accentColor ? `${accentColor}55` : "#e5e7eb" }}
        onDoubleClick={() => setEditing(true)}
      >
        {editing ? (
          <input
            autoFocus
            className="nodrag nopan w-full bg-transparent outline-none"
            defaultValue={data.label}
            onBlur={(event) => {
              updateNodeLabel(id, event.target.value || "Untitled Container");
              setEditing(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        ) : (
          <span>{data.label}</span>
        )}
      </div>
      <div className="flex-1" />
    </div>
  );
}

export default memo(ContainerNodeComponent);
