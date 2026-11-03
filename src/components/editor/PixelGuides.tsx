"use client";

import { useEffect, useState } from "react";
import { ViewportPortal, useStore } from "@xyflow/react";
import { create } from "zustand";
import { boxOf, distancesBetween, type Box, type Gap, type GuideLine } from "@/lib/diagram/guides";
import { absolutePosition } from "@/lib/diagram/layout";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";

/**
 * What the canvas is measuring right now: guide lines and gaps while a box is dragged, its size while it's
 * resized. Screen state, not part of the diagram.
 */
interface GuidesState {
  lines: GuideLine[];
  gaps: Gap[];
  /** A readout beside the box being moved or resized: "x 120 · y 48" or "160 × 56". */
  readout: { box: Box; text: string } | null;
  /** The box under the pointer, for Alt + hover measuring. */
  hoveredId: string | null;
  show: (guides: Pick<GuidesState, "lines" | "gaps" | "readout">) => void;
  clear: () => void;
  hover: (id: string | null) => void;
}

export const useGuides = create<GuidesState>()((set) => ({
  lines: [],
  gaps: [],
  readout: null,
  hoveredId: null,
  show: (guides) => set(guides),
  clear: () => set({ lines: [], gaps: [], readout: null }),
  hover: (hoveredId) => set({ hoveredId }),
}));

const GUIDE_COLOR = "#ec4899";
const GAP_COLOR = "#f97316";

/** Whether Alt (Option) is held, for measuring from the selection to the box under the pointer. */
function useAltKey() {
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    const update = (event: KeyboardEvent | PointerEvent) => setAlt(event.altKey);
    const reset = () => setAlt(false);
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("pointermove", update);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", update);
      window.removeEventListener("keyup", update);
      window.removeEventListener("pointermove", update);
      window.removeEventListener("blur", reset);
    };
  }, []);
  return alt;
}

/** Hold Alt with a box selected and point at another box to see the distances between them. */
function useAltMeasure(): { from: Box; to: Box; gaps: Gap[] } | null {
  const alt = useAltKey();
  const hoveredId = useGuides((state) => state.hoveredId);
  const selectedIds = useDiagramStore((state) => state.selectedNodeIds);
  const diagram = useDiagramStore((state) => state.diagram);
  if (!alt || !hoveredId || selectedIds.length !== 1 || selectedIds[0] === hoveredId) return null;
  const nodes = getActiveSection(diagram).nodes;
  const selected = nodes.find((node) => node.id === selectedIds[0]);
  const hovered = nodes.find((node) => node.id === hoveredId);
  if (!selected || !hovered) return null;
  const from = boxOf(absolutePosition(selected, nodes), selected.size);
  const to = boxOf(absolutePosition(hovered, nodes), hovered.size);
  return { from, to, gaps: distancesBetween(from, to) };
}

/** Drawn in canvas coordinates; widths and labels are divided by the zoom so they stay the same on screen. */
export default function PixelGuides() {
  const zoom = useStore((state) => state.transform[2]);
  const lines = useGuides((state) => state.lines);
  const gaps = useGuides((state) => state.gaps);
  const readout = useGuides((state) => state.readout);
  const measure = useAltMeasure();
  const shownGaps = measure ? measure.gaps : gaps;
  if (!lines.length && !shownGaps.length && !readout && !measure) return null;

  const px = 1 / zoom;
  return (
    <ViewportPortal>
      <svg
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 overflow-visible"
        style={{ zIndex: 1000 }}
        width={1}
        height={1}
      >
        {measure && (
          <>
            <rect {...measure.from} fill="none" stroke="#2563eb" strokeWidth={1.5 * px} />
            <rect {...measure.to} fill="none" stroke={GAP_COLOR} strokeWidth={1.5 * px} strokeDasharray={`${4 * px} ${3 * px}`} />
          </>
        )}
        {lines.map((line, index) =>
          line.axis === "x" ? (
            <line key={index} x1={line.at} x2={line.at} y1={line.from} y2={line.to} stroke={GUIDE_COLOR} strokeWidth={px} />
          ) : (
            <line key={index} y1={line.at} y2={line.at} x1={line.from} x2={line.to} stroke={GUIDE_COLOR} strokeWidth={px} />
          ),
        )}
        {shownGaps.map((gap, index) => (
          <GapMeasure key={index} gap={gap} px={px} />
        ))}
      </svg>
      {readout && <Readout box={readout.box} text={readout.text} zoom={zoom} />}
    </ViewportPortal>
  );
}

/** A measured line with end ticks and its length in pixels. */
function GapMeasure({ gap, px }: { gap: Gap; px: number }) {
  const tick = 4 * px;
  const horizontal = gap.axis === "x";
  const middle = (gap.from + gap.to) / 2;
  const [x1, y1, x2, y2] = horizontal ? [gap.from, gap.at, gap.to, gap.at] : [gap.at, gap.from, gap.at, gap.to];
  const label = String(gap.length);
  const labelWidth = (label.length * 6.5 + 8) * px;
  const labelHeight = 14 * px;
  const [lx, ly] = horizontal ? [middle, gap.at - labelHeight - 2 * px] : [gap.at + 4 * px + labelWidth / 2, middle - labelHeight / 2];
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GAP_COLOR} strokeWidth={px} />
      {horizontal ? (
        <>
          <line x1={x1} x2={x1} y1={y1 - tick} y2={y1 + tick} stroke={GAP_COLOR} strokeWidth={px} />
          <line x1={x2} x2={x2} y1={y2 - tick} y2={y2 + tick} stroke={GAP_COLOR} strokeWidth={px} />
        </>
      ) : (
        <>
          <line y1={y1} y2={y1} x1={x1 - tick} x2={x1 + tick} stroke={GAP_COLOR} strokeWidth={px} />
          <line y1={y2} y2={y2} x1={x2 - tick} x2={x2 + tick} stroke={GAP_COLOR} strokeWidth={px} />
        </>
      )}
      <rect x={lx - labelWidth / 2} y={ly} width={labelWidth} height={labelHeight} rx={3 * px} fill={GAP_COLOR} />
      <text
        x={lx}
        y={ly + labelHeight / 2}
        fill="#ffffff"
        fontSize={10 * px}
        fontWeight={600}
        fontFamily="ui-monospace, monospace"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {label}
      </text>
    </g>
  );
}

/** A small badge under the box: its position while moving, its size while resizing. */
function Readout({ box, text, zoom }: { box: Box; text: string; zoom: number }) {
  return (
    <div
      className="pointer-events-none absolute whitespace-nowrap rounded bg-blue-600 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white shadow"
      style={{
        left: box.x + box.width / 2,
        top: box.y + box.height + 6 / zoom,
        transform: `translateX(-50%) scale(${1 / zoom})`,
        transformOrigin: "top center",
        zIndex: 1001,
      }}
    >
      {text}
    </div>
  );
}
