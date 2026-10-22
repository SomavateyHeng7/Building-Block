"use client";

import { memo, useRef } from "react";
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from "@xyflow/react";
import { connectionPath, type FlowEdge } from "@/lib/diagram/flowAdapter";
import { useDiagramStore } from "@/lib/diagram/store";
import type { Position } from "@/lib/diagram/types";
import { useReadOnly } from "../viewMode";

const SNAP = 8;
const snap = (value: number) => Math.round(value / SNAP) * SNAP;

/**
 * A connection: right-angled, curved or straight. Selected, it shows a dot to drag the middle of the line
 * clear of other boxes; double-clicking the dot puts the line back.
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

  const bend = data?.bend;
  const { path, labelX, labelY } = connectionPath(
    { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition },
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
        label={props.label}
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
      {selected && !readOnly && (
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
