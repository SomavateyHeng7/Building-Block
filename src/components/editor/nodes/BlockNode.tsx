"use client";

import { memo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { componentIcon } from "@/lib/diagram/componentIcons";
import { defaultLabel } from "@/lib/diagram/factory";
import { readableTextOn } from "@/lib/diagram/palette";
import { useDiagramStore } from "@/lib/diagram/store";
import type { BlockNodeData } from "@/lib/diagram/types";
import { showDetails } from "../detailsPanel";
import { useReadOnly } from "../viewMode";

export type BlockFlowNode = Node<BlockNodeData, "block">;

export const SIDES = [
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
      {data.notes && <NotesMarker id={id} notes={data.notes} />}
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
              <span className="text-[10px] font-normal">[{data.technology}]</span>
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

/** Starters for a line of notes (see NotesField); a line starting with one is tagged in the notes card. */
export const NOTE_KINDS = ["Assumption", "Risk", "Open question", "Decision"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export const NOTES_FIELD_ID = "bb-notes-field";

const NOTE_KIND_STYLES: Record<NoteKind, string> = {
  Assumption: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  Risk: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  "Open question": "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  Decision: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

/** Room above the badge for the card; with less, it opens below instead of going off screen. */
const CARD_ROOM = 160;

/** Notes line by line, with "Risk:"-style starts shown as tags (the notes card and the view sheet). */
export function NoteLines({ notes }: { notes: string }) {
  return (
    <div className="flex flex-col gap-0.5 whitespace-pre-wrap break-words">
      {notes.split("\n").map((line, index) => (
        <NoteLine key={index} line={line} />
      ))}
    </div>
  );
}

/** One line of notes, with a "Risk:"-style start shown as a tag. */
function NoteLine({ line }: { line: string }) {
  const kind = NOTE_KINDS.find((candidate) => line.toLowerCase().startsWith(`${candidate.toLowerCase()}:`));
  if (!kind) return <div className="min-h-[1lh]">{line}</div>;
  return (
    <div>
      <span className={`mr-1 rounded px-1 py-px text-[10px] font-semibold ${NOTE_KIND_STYLES[kind]}`}>{kind}</span>
      {line.slice(kind.length + 1).trim()}
    </div>
  );
}

/**
 * Corner badge telling the SA this node has notes. Hovering or focusing it shows them in a card; clicking it
 * selects the node and puts the cursor in its Notes field (in view mode, it pins the card open instead).
 */
export function NotesMarker({ id, notes }: { id: string; notes: string }) {
  const readOnly = useReadOnly();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [pinned, setPinned] = useState(false);
  const open = (event: { currentTarget: Element }) => setAnchor(event.currentTarget.getBoundingClientRect());
  const close = () => {
    if (!pinned) setAnchor(null);
  };
  const below = anchor ? anchor.top < CARD_ROOM : false;

  return (
    <>
      <button
        type="button"
        aria-label={readOnly ? "Show notes" : "Edit notes"}
        aria-expanded={!!anchor}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={() => {
          setPinned(false);
          setAnchor(null);
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (readOnly) {
            setPinned((value) => !value);
            open(event);
            return;
          }
          setAnchor(null);
          useDiagramStore.getState().setSelection([id]);
          // Opens the panel if it's a closed drawer or collapsed, then puts the cursor in this node's Notes.
          showDetails(NOTES_FIELD_ID);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        className="nodrag nopan absolute -right-2 -top-2 flex h-5 w-5 min-h-0 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-amber-950 shadow-sm transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-zinc-900"
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 4h14v11l-5 5H5zM14 20v-5h5M9 9h6M9 13h3" />
        </svg>
      </button>
      {anchor &&
        createPortal(
          <div
            role="tooltip"
            className={`bb-notes-tooltip ${below ? "bb-notes-tooltip-below" : ""} pointer-events-none fixed z-[1000] w-max max-w-xs rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-left text-xs font-normal leading-relaxed text-zinc-700 shadow-xl ring-1 ring-black/5 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200`}
            style={{ left: anchor.left + anchor.width / 2, top: below ? anchor.bottom + 8 : anchor.top - 8 }}
          >
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Notes
            </div>
            <NoteLines notes={notes} />
            {!readOnly && <div className="mt-1.5 text-[10px] text-zinc-400">Click the badge to edit</div>}
          </div>,
          document.body,
        )}
    </>
  );
}

export default memo(BlockNodeComponent);
