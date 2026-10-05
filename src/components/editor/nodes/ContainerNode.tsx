"use client";

import { memo, useState } from "react";
import { NodeResizer, NodeToolbar, Position, type Node, type NodeProps } from "@xyflow/react";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { CONTAINER_MIN, containerInsets } from "@/lib/diagram/layout";
import type { ContainerNodeData, HeaderAlign, HeaderPosition } from "@/lib/diagram/types";
import { NotesMarker } from "./BlockNode";

export type ContainerFlowNode = Node<ContainerNodeData, "container">;

/** The box lays out header and body in a row or column; reversed puts the header last. */
const BOX_DIRECTION: Record<HeaderPosition, React.CSSProperties["flexDirection"]> = {
  top: "column",
  bottom: "column-reverse",
  left: "row",
  right: "row-reverse",
};

/** Rounds the header's outer corners to match the box (4px inside a 6px-radius, 2px border). */
const HEADER_CORNERS: Record<HeaderPosition, string> = {
  top: "4px 4px 0 0",
  bottom: "0 0 4px 4px",
  left: "4px 0 0 4px",
  right: "0 4px 4px 0",
};

const JUSTIFY: Record<HeaderAlign, React.CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};

const TEXT_ALIGN: Record<HeaderAlign, React.CSSProperties["textAlign"]> = {
  start: "left",
  center: "center",
  end: "right",
};

/** Side headers read bottom-to-top on the left and top-to-bottom on the right. */
const VERTICAL_TEXT: Partial<Record<HeaderPosition, React.CSSProperties>> = {
  left: { writingMode: "vertical-rl", transform: "rotate(180deg)" },
  right: { writingMode: "vertical-rl" },
};

function ContainerNodeComponent({ id, data, selected }: NodeProps<ContainerFlowNode>) {
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  const legend = useDiagramStore((state) => state.diagram.legend);
  const fitContainer = useDiagramStore((state) => state.fitContainer);
  const tidyContainer = useDiagramStore((state) => state.tidyContainer);
  // Right and bottom edges of the components inside, so resizing can't clip them.
  const contentRight = useDiagramStore((state) =>
    getActiveSection(state.diagram).nodes.reduce(
      (max, node) => (node.parentId === id ? Math.max(max, node.position.x + node.size.width) : max),
      0,
    ),
  );
  const contentBottom = useDiagramStore((state) =>
    getActiveSection(state.diagram).nodes.reduce(
      (max, node) => (node.parentId === id ? Math.max(max, node.position.y + node.size.height) : max),
      0,
    ),
  );
  const [editing, setEditing] = useState(false);

  const accentColor = legend.find((entry) => entry.key === data.colorKey)?.color;
  const headerPosition = data.headerPosition ?? "top";
  const headerAlign = data.headerAlign ?? "start";
  const vertical = headerPosition === "left" || headerPosition === "right";
  const insets = containerInsets(data);

  return (
    <div
      className={`group relative flex h-full w-full rounded-md border-2 bg-white/60 dark:bg-black/30 ${
        selected ? "ring-2 ring-blue-600 ring-offset-1 dark:ring-offset-zinc-900" : ""
      }`}
      style={{
        flexDirection: BOX_DIRECTION[headerPosition],
        borderColor: data.outlineColor ?? accentColor ?? "#9ca3af",
        borderStyle: data.outlineStyle ?? "solid",
      }}
    >
      {/* Always active so any edge or corner can be dragged; only drawn on hover or when selected. */}
      <NodeResizer
        minWidth={Math.max(CONTAINER_MIN.width, contentRight + insets.right)}
        minHeight={Math.max(CONTAINER_MIN.height, contentBottom + insets.bottom)}
        color="#2563eb"
        handleStyle={{ width: 10, height: 10, borderRadius: 2 }}
        handleClassName={selected ? "" : "opacity-0 group-hover:opacity-100"}
        lineClassName={selected ? "" : "opacity-0 group-hover:opacity-100"}
      />
      {contentRight > 0 && (
        <NodeToolbar position={Position.Top} align="end" offset={6}>
          <div className="flex gap-1 rounded-md border border-zinc-200 bg-white p-1 text-[11px] font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <button
              type="button"
              className="rounded px-2 py-0.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              title="Shrink or grow the container to wrap its components"
              onClick={() => fitContainer(id)}
            >
              Fit to contents
            </button>
            <button
              type="button"
              className="rounded px-2 py-0.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              title="Arrange the components inside in a neat grid"
              onClick={() => tidyContainer(id)}
            >
              Tidy layout
            </button>
          </div>
        </NodeToolbar>
      )}
      {data.notes && <NotesMarker notes={data.notes} />}
      <div
        data-container-header={headerPosition}
        className={`flex shrink-0 items-center text-xs font-semibold text-zinc-800 dark:text-zinc-100 ${
          accentColor ? "" : "bg-zinc-200 dark:bg-zinc-800"
        }`}
        style={{
          flexDirection: vertical ? "column" : "row",
          justifyContent: JUSTIFY[headerAlign],
          // Side headers are a fixed-width strip; top and bottom size to the label.
          width: vertical ? 28 : undefined,
          padding: vertical ? "8px 4px" : "4px 8px",
          borderRadius: HEADER_CORNERS[headerPosition],
          backgroundColor: accentColor ? `${accentColor}55` : undefined,
        }}
        onDoubleClick={() => setEditing(true)}
      >
        {editing ? (
          <input
            autoFocus
            className="nodrag nopan w-full bg-transparent outline-none"
            style={{ ...VERTICAL_TEXT[headerPosition], textAlign: TEXT_ALIGN[headerAlign], height: vertical ? "100%" : undefined }}
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
          <span title={data.description} className="max-h-full max-w-full truncate" style={VERTICAL_TEXT[headerPosition]}>
            {data.label}
          </span>
        )}
      </div>
      <div className="flex-1" />
    </div>
  );
}

export default memo(ContainerNodeComponent);
