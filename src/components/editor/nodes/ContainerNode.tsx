"use client";

import { memo, useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useDiagramStore } from "@/lib/diagram/store";
import type { ContainerNodeData } from "@/lib/diagram/types";
import { NotesMarker } from "./BlockNode";

export type ContainerFlowNode = Node<ContainerNodeData, "container">;

function ContainerNodeComponent({ id, data, selected }: NodeProps<ContainerFlowNode>) {
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  const legend = useDiagramStore((state) => state.diagram.legend);
  const [editing, setEditing] = useState(false);

  const accentColor = legend.find((entry) => entry.key === data.colorKey)?.color;

  return (
    <div
      className={`relative flex h-full w-full flex-col rounded-md border-2 bg-white/60 dark:bg-black/30 ${
        selected ? "ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-zinc-900" : ""
      }`}
      style={{ borderColor: accentColor ?? "#9ca3af" }}
    >
      <NodeResizer minWidth={200} minHeight={120} isVisible={selected} />
      {data.notes && <NotesMarker notes={data.notes} />}
      <div
        className={`flex items-center justify-between rounded-t px-2 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100 ${
          accentColor ? "" : "bg-zinc-200 dark:bg-zinc-800"
        }`}
        style={accentColor ? { backgroundColor: `${accentColor}55` } : undefined}
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
          <span title={data.description}>{data.label}</span>
        )}
      </div>
      <div className="flex-1" />
    </div>
  );
}

export default memo(ContainerNodeComponent);
