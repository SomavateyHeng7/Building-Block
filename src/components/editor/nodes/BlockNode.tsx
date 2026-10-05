"use client";

import { memo, useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useDiagramStore } from "@/lib/diagram/store";
import type { BlockNodeData } from "@/lib/diagram/types";

export type BlockFlowNode = Node<BlockNodeData, "block">;

function BlockNodeComponent({ id, data, selected }: NodeProps<BlockFlowNode>) {
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  const legend = useDiagramStore((state) => state.diagram.legend);
  const showTechnology = useDiagramStore((state) => state.diagram.showTechnology !== false);
  const [editing, setEditing] = useState(false);

  const entryColor = legend.find((entry) => entry.key === data.colorKey)?.color;
  const color = entryColor ?? "#ffffff";

  return (
    <div
      className="relative flex h-full w-full items-center justify-center rounded border text-center text-xs font-medium"
      title={data.description ?? (entryColor ? undefined : "No legend category assigned")}
      style={{
        backgroundColor: color,
        borderColor: selected ? "#2563eb" : "rgba(0,0,0,0.25)",
        borderStyle: entryColor ? "solid" : "dashed",
        color: textColorFor(color),
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <NodeResizer minWidth={80} minHeight={32} isVisible={selected} />
      {data.notes && <NotesMarker notes={data.notes} />}
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
        <span className="flex flex-col px-1 leading-tight">
          <span>{data.label}</span>
          {showTechnology && data.technology && (
            <span className="text-[10px] font-normal opacity-75">[{data.technology}]</span>
          )}
        </span>
      )}
    </div>
  );
}

/** Corner badge telling the SA this node has notes; hover shows them. */
export function NotesMarker({ notes }: { notes: string }) {
  return (
    <span
      title={`Notes: ${notes}`}
      aria-label="Has notes"
      className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-amber-500 text-[9px] font-bold leading-none text-white shadow-sm dark:border-zinc-900"
    >
      !
    </span>
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
