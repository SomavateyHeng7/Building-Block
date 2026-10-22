"use client";

import { memo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { componentIcon } from "@/lib/diagram/componentIcons";
import { defaultLabel } from "@/lib/diagram/factory";
import { readableTextOn } from "@/lib/diagram/palette";
import { useDiagramStore } from "@/lib/diagram/store";
import type { BlockNodeData } from "@/lib/diagram/types";
import { useReadOnly } from "../viewMode";

export type BlockFlowNode = Node<BlockNodeData, "block">;

const SIDES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

function BlockNodeComponent({ id, data, selected }: NodeProps<BlockFlowNode>) {
  const updateNodeLabel = useDiagramStore((state) => state.updateNodeLabel);
  const legend = useDiagramStore((state) => state.diagram.legend);
  const showTechnology = useDiagramStore((state) => state.diagram.showTechnology !== false);
  const readOnly = useReadOnly();
  const [editing, setEditing] = useState(false);
  // Escape leaves the name as it was; the blur that follows must not save what was typed.
  const cancelled = useRef(false);

  const entryColor = legend.find((entry) => entry.key === data.colorKey)?.color;
  const color = entryColor ?? "#ffffff";
  const icon = componentIcon(data.icon);

  return (
    <div
      className="relative flex h-full w-full items-center justify-center rounded border text-center text-xs font-medium"
      title={data.description ?? (entryColor ? undefined : "No legend category assigned")}
      style={{
        backgroundColor: color,
        borderColor: selected ? "#2563eb" : "rgba(0,0,0,0.25)",
        borderStyle: entryColor ? "solid" : "dashed",
        color: readableTextOn(color),
      }}
      onDoubleClick={() => {
        if (readOnly) return;
        cancelled.current = false;
        setEditing(true);
      }}
    >
      <NodeResizer minWidth={80} minHeight={32} isVisible={selected && !readOnly} />
      {/* Every side starts and ends connections (the canvas uses loose connection mode). */}
      {SIDES.map((side) => (
        <Handle key={side.id} id={side.id} type="source" position={side.position} className="bb-handle" />
      ))}
      {data.notes && <NotesMarker notes={data.notes} />}
      {data.detail?.nodes.length ? <DetailBadge id={id} count={data.detail.nodes.length} /> : null}
      {editing ? (
        <input
          autoFocus
          className="nodrag nopan w-full bg-transparent px-1 text-center outline-none"
          defaultValue={data.label}
          onBlur={(event) => {
            if (!cancelled.current) updateNodeLabel(id, event.target.value.trim() ? event.target.value : defaultLabel("block"));
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              cancelled.current = true;
              event.currentTarget.blur();
            }
          }}
        />
      ) : (
        <span className="flex min-w-0 items-center gap-1.5 px-1">
          {icon && <ComponentIcon path={icon.path} label={icon.label} />}
          <span className="flex min-w-0 flex-col leading-tight">
            <span>{data.label}</span>
            {showTechnology && data.technology && (
              <span className="text-[10px] font-normal opacity-75">[{data.technology}]</span>
            )}
          </span>
        </span>
      )}
    </div>
  );
}

/** The component's built-in icon, in the label's colour so it reads on any category colour. */
export function ComponentIcon({ path, label, className = "h-4 w-4 shrink-0" }: { path: string; label?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label && <title>{label}</title>}
      <path d={path} />
    </svg>
  );
}

/** Corner badge on a component that has an internal design (L2); clicking it opens that design. */
function DetailBadge({ id, count }: { id: string; count: number }) {
  const openDetail = useDiagramStore((state) => state.openDetail);
  const label = `Open internal design (${count} item${count === 1 ? "" : "s"})`;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="nodrag nopan absolute -bottom-2 -right-2 flex h-4 min-h-0 items-center gap-0.5 rounded-full border border-white bg-blue-600 px-1.5 text-[9px] font-bold leading-none text-white shadow-sm hover:bg-blue-700 dark:border-zinc-900"
      onClick={(event) => {
        event.stopPropagation();
        openDetail(id);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      L2
    </button>
  );
}

/** Corner badge telling the SA this node has notes; hovering shows them instantly in a card. */
export function NotesMarker({ notes }: { notes: string }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  return (
    <>
      <span
        aria-label={`Has notes: ${notes}`}
        onMouseEnter={(event) => setAnchor(event.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setAnchor(null)}
        className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-amber-500 text-[9px] font-bold leading-none text-white shadow-sm dark:border-zinc-900"
      >
        !
      </span>
      {anchor &&
        createPortal(
          <div
            role="tooltip"
            className="bb-notes-tooltip pointer-events-none fixed z-[1000] max-w-xs rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-left text-xs font-normal leading-relaxed text-zinc-700 shadow-xl ring-1 ring-black/5 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200"
            style={{ left: anchor.left + anchor.width / 2, top: anchor.top - 8 }}
          >
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Notes
            </div>
            <div className="whitespace-pre-wrap break-words">{notes}</div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default memo(BlockNodeComponent);
