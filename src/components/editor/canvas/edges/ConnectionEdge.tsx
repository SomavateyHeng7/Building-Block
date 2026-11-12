"use client";

import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, useReactFlow, useStore, type EdgeProps } from "@xyflow/react";
import { EdgeCommentMarker } from "../nodes/CommentMarker";
import { connectionPath, type FlowEdge } from "@/lib/diagram/layout/flowAdapter";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { connectionSuggestions } from "@/lib/diagram/features/levelTools";
import type { Position } from "@/lib/diagram/types";
import { useReadOnly } from "@/components/editor/shared/viewMode";
import { stopEditingEdge, useEdgeEditing } from "./edgeEditing";

const CAPTION_FIELD =
  "nodrag nopan w-32 min-w-0 rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 pointer-coarse:text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

/**
 * Typing a connection's caption right on the line: what flows, then the protocol. Enter (or clicking away) keeps
 * it as one undo step; Esc leaves it as it was. Tab moves between the two.
 */
function CaptionEditor({ id, x, y }: { id: string; x: number; y: number }) {
  const edge = useDiagramStore((state) => getActiveSection(state.diagram).edges?.find((candidate) => candidate.id === id));
  const diagram = useDiagramStore((state) => state.diagram);
  const protocols = useMemo(() => connectionSuggestions(diagram).protocols, [diagram]);
  const updateConnection = useDiagramStore((state) => state.updateConnection);
  const [label, setLabel] = useState(edge?.label ?? "");
  const [protocol, setProtocol] = useState(edge?.protocol ?? "");
  const card = useRef<HTMLFormElement>(null);
  const done = useRef(false);
  // Screen-sized at any zoom: zoomed out on a big diagram, a canvas-sized editor would be too small to type in.
  const zoom = useStore((state) => state.transform[2]);

  // Kept inside the canvas: a line near the edge of a phone screen would otherwise put half the editor off it.
  // The nudge is in screen pixels, set as CSS variables so React's own transform stays as it is.
  useLayoutEffect(() => {
    const form = card.current;
    const pane = form?.closest(".react-flow")?.getBoundingClientRect();
    if (!form || !pane) return;
    form.style.setProperty("--bb-dx", "0px");
    form.style.setProperty("--bb-dy", "0px");
    const box = form.getBoundingClientRect();
    const MARGIN = 8;
    const nudge = (start: number, size: number, min: number, max: number) =>
      size > max - min - 2 * MARGIN ? min + MARGIN - start : Math.max(min + MARGIN - start, Math.min(0, max - MARGIN - (start + size)));
    form.style.setProperty("--bb-dx", `${nudge(box.left, box.width, pane.left, pane.right)}px`);
    form.style.setProperty("--bb-dy", `${nudge(box.top, box.height, pane.top, pane.bottom)}px`);
  }, [x, y, zoom]);

  function finish(keep: boolean) {
    if (done.current) return;
    done.current = true;
    if (keep && edge && (label !== (edge.label ?? "") || protocol !== (edge.protocol ?? ""))) {
      updateConnection(id, { label, protocol }, { ownStep: true });
    }
    stopEditingEdge();
  }

  return (
    <form
      ref={card}
      className="nodrag nopan absolute z-10 flex items-center gap-1 rounded-md border border-blue-500 bg-white p-1 shadow-lg dark:bg-zinc-950"
      style={{
        transform: `translate(${x}px, ${y}px) scale(${1 / zoom}) translate(-50%, -50%) translate(var(--bb-dx, 0px), var(--bb-dy, 0px))`,
        transformOrigin: "0 0",
        pointerEvents: "all",
      }}
      onSubmit={(event) => {
        event.preventDefault();
        finish(true);
      }}
      onKeyDown={(event) => {
        // The canvas's own keys (Delete, arrows, shortcuts) stay out of the way while typing.
        event.stopPropagation();
        if (event.key === "Escape") finish(false);
      }}
      onBlur={(event) => {
        if (!card.current?.contains(event.relatedTarget as Node | null)) finish(true);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <input
        aria-label="What flows"
        placeholder="What flows"
        autoFocus
        className={CAPTION_FIELD}
        value={label}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setLabel(event.target.value)}
      />
      <input
        aria-label="Protocol or technology"
        placeholder="Protocol"
        list="canvas-protocol-suggestions"
        className={`${CAPTION_FIELD} w-24`}
        value={protocol}
        onChange={(event) => setProtocol(event.target.value)}
      />
      <datalist id="canvas-protocol-suggestions">
        {protocols.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      {/* Enter submits; the button is for touch, where there's no Enter key to hand. */}
      <button
        type="submit"
        aria-label="Done"
        title="Done (Enter)"
        className="flex h-7 w-7 min-h-0 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
      >
        ✓
      </button>
    </form>
  );
}

/** Whole pixels, like every other move on the canvas, so a line's middle can be put exactly where it's wanted. */
const snap = (value: number) => Math.round(value);

/**
 * A connection: right-angled, curved or straight. Selected, it shows a dot to drag the middle of the line
 * clear of other boxes; double-clicking the dot puts the line back. Double-clicking the line types its caption.
 */
function ConnectionEdgeComponent({
  id,
  data,
  selected,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  ...props
}: EdgeProps<FlowEdge>) {
  const readOnly = useReadOnly();
  const updateConnection = useDiagramStore((state) => state.updateConnection);
  const { screenToFlowPosition } = useReactFlow();
  const drag = useRef<{ start: Position; bend: Position } | null>(null);
  // Only while it's still the selected connection: clicking elsewhere, or another view, ends it.
  const editing = useEdgeEditing((state) => state.id === id) && !!selected && !readOnly;

  const bend = data?.bend;
  // Lines that would lie on top of each other are drawn side by side (see parallelShifts).
  const shift = data?.shift;
  const { path, labelX, labelY } = connectionPath(
    {
      sourceX: sourceX + (shift?.source.x ?? 0),
      sourceY: sourceY + (shift?.source.y ?? 0),
      sourcePosition,
      targetX: targetX + (shift?.target.x ?? 0),
      targetY: targetY + (shift?.target.y ?? 0),
      targetPosition,
    },
    data?.shape ?? "step",
    bend,
  );
  // The dot sits just above the label so it doesn't cover the text.
  const dotY = props.label ? labelY - 20 : labelY;

  return (
    <>
      <BaseEdge
        path={path}
        labelX={labelX}
        labelY={labelY}
        label={editing ? undefined : props.label}
        labelStyle={props.labelStyle}
        labelShowBg={props.labelShowBg}
        labelBgStyle={props.labelBgStyle}
        labelBgPadding={props.labelBgPadding}
        labelBgBorderRadius={props.labelBgBorderRadius}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        style={props.style}
        interactionWidth={props.interactionWidth}
      />
      <EdgeCommentMarker id={id} x={labelX} y={labelY} />
      {editing && (
        <EdgeLabelRenderer>
          <CaptionEditor id={id} x={labelX} y={labelY} />
        </EdgeLabelRenderer>
      )}
      {selected && !readOnly && !editing && (
        <EdgeLabelRenderer>
          <button
            type="button"
            title="Drag to move the line; double-click to put it back"
            aria-label="Move the line"
            className="bb-bend nodrag nopan absolute flex h-6 w-6 min-h-0 cursor-move touch-none items-center justify-center rounded-full"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${dotY}px)`, pointerEvents: "all" }}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                start: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
                bend: bend ?? { x: 0, y: 0 },
              };
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
              const next = {
                x: snap(drag.current.bend.x + point.x - drag.current.start.x),
                y: snap(drag.current.bend.y + point.y - drag.current.start.y),
              };
              if (next.x !== bend?.x || next.y !== bend?.y) {
                updateConnection(id, { bend: next.x || next.y ? next : undefined });
              }
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              updateConnection(id, { bend: undefined });
            }}
          >
            <span
              aria-hidden
              className="block h-3 w-3 rounded-full border-2 border-white shadow dark:border-zinc-900"
              style={{ backgroundColor: "#2563eb" }}
            />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(ConnectionEdgeComponent);
