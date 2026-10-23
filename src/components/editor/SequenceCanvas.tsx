"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTheme } from "next-themes";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { readableTextOn } from "@/lib/diagram/palette";
import {
  SEQUENCE_LAYOUT as L,
  addParticipant,
  addStep,
  columnAt,
  layoutSequence,
  messageCaption,
  messageNumbers,
  newMessage,
  newParticipant,
  stepIndexAt,
  type SequenceLayout,
} from "@/lib/diagram/sequence";
import type { SequenceDiagram, SequenceMessage, SequenceNote, SequenceParticipant } from "@/lib/diagram/types";
import { showDetails } from "./detailsPanel";
import { Icon } from "./Icon";
import { SEQUENCE_LABEL_FIELD_ID, selectSequenceItem, useSequenceSelection } from "./sequenceSelection";
import { useReadOnly } from "./viewMode";

const EMPTY: SequenceDiagram = { participants: [], steps: [] };
/** Pointer travel below this is a click, not a drag. */
const DRAG_THRESHOLD = 8;
const ARROW = 9;
const SELECTED = "#2563eb";

/**
 * Colours are SVG attributes, not Tailwind classes: the picture export copies the sheet, and classes on SVG
 * elements don't come through (lifelines vanished and notes turned black).
 */
const INK = {
  light: { text: "#3f3f46", lifeline: "#d4d4d8", noteFill: "#fffbeb", noteStroke: "#fcd34d", noteText: "#451a03" },
  dark: { text: "#e4e4e7", lifeline: "#3f3f46", noteFill: "#451a03", noteStroke: "#92400e", noteText: "#fef3c7" },
};
type Ink = (typeof INK)["light"];

/** A message being drawn: dragged from one lifeline towards another. */
interface Draft {
  from: string;
  startX: number;
  y: number;
  x: number;
  pointerY: number;
}

/**
 * A sequence tab: participants across the top, steps down the page, laid out from the content (see
 * `layoutSequence`). Drag from one lifeline to another to add a message where you let go; click anything to
 * edit it in the panel. Drawn as SVG at 1:1, so the export takes the same picture (`.bb-sequence-sheet`).
 */
export default function SequenceCanvas() {
  const view = useDiagramStore((state) => getActiveSection(state.diagram));
  const legend = useDiagramStore((state) => state.diagram.legend);
  const updateSequence = useDiagramStore((state) => state.updateSequence);
  const selected = useSequenceSelection((state) => state.id);
  const readOnly = useReadOnly();
  const ink = INK[useTheme().resolvedTheme === "dark" ? "dark" : "light"];
  const sequence = view.sequence ?? EMPTY;
  const layout = useMemo(() => layoutSequence(sequence), [sequence]);
  const numbers = useMemo(() => (sequence.numbered === false ? null : messageNumbers(sequence)), [sequence]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const colorOf = (participant: SequenceParticipant) => legend.find((entry) => entry.key === participant.colorKey)?.color;
  const columnOf = (id: string) => layout.columns.find((column) => column.participant.id === id);

  function local(event: ReactPointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function addFirst(shape: SequenceParticipant["shape"]) {
    const participant = newParticipant(shape === "actor" ? "User" : "New participant", shape);
    updateSequence((current) => addParticipant(current, participant));
    selectSequenceItem(participant.id);
    showDetails(SEQUENCE_LABEL_FIELD_ID);
  }

  function finishDraft(event: ReactPointerEvent) {
    if (!draft) return;
    setDraft(null);
    const point = local(event);
    const moved = Math.hypot(point.x - draft.startX, point.y - draft.y) >= DRAG_THRESHOLD;
    if (!moved) {
      selectSequenceItem(draft.from);
      return;
    }
    const target = columnAt(layout, point.x);
    if (!target) return;
    const message = newMessage(draft.from, target.participant.id);
    updateSequence((current) => addStep(current, message, stepIndexAt(layout, draft.y)));
    selectSequenceItem(message.id);
    showDetails(SEQUENCE_LABEL_FIELD_ID);
  }

  if (!sequence.participants.length) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-900">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            <Icon name="swap" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">Who takes part in this flow?</p>
            <p className="mt-1">Add the people and systems involved, then drag from one lifeline to another to add each message.</p>
          </div>
          {readOnly ? (
            <p className="text-xs text-zinc-500">Switch to Edit to add something.</p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                onClick={() => addFirst("participant")}
              >
                <Icon name="plus" />
                Participant
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                onClick={() => addFirst("actor")}
              >
                <Icon name="plus" />
                Actor (person)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full overflow-auto bg-zinc-50 dark:bg-zinc-900"
      onClick={(event) => {
        if (event.target === event.currentTarget) selectSequenceItem(null);
      }}
    >
      {/* The sheet is what exports picture, so spacing and the frame sit on this wrapper, not on it. */}
      <div className="m-4 w-max border border-zinc-200 dark:border-zinc-800">
        <div className="bb-sequence-sheet bg-white dark:bg-zinc-950" style={{ width: layout.width, height: layout.height }}>
          <svg
            ref={svgRef}
            role="img"
            aria-label={`Sequence diagram: ${sequence.participants.length} participants, ${sequence.steps.length} steps`}
            width={layout.width}
            height={layout.height}
            className="block select-none"
            color={ink.text}
            onClick={(event) => {
              if (event.target === event.currentTarget) selectSequenceItem(null);
            }}
          >
            {layout.columns.map((column) => (
              <line
                key={column.participant.id}
                x1={column.x}
                x2={column.x}
                y1={layout.lifelineTop}
                y2={layout.lifelineBottom}
                strokeDasharray="4 4"
                stroke={ink.lifeline}
              />
            ))}

            {!readOnly &&
              layout.columns.map((column) => (
                <rect
                  key={column.participant.id}
                  data-lifeline={column.participant.id}
                  x={column.x - 12}
                  y={layout.lifelineTop}
                  width={24}
                  height={layout.lifelineBottom - layout.lifelineTop}
                  fill="transparent"
                  className="cursor-crosshair"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const point = local(event);
                    setDraft({ from: column.participant.id, startX: point.x, y: point.y, x: point.x, pointerY: point.y });
                  }}
                  onPointerMove={(event) => {
                    if (!draft) return;
                    const point = local(event);
                    setDraft({ ...draft, x: point.x, pointerY: point.y });
                  }}
                  onPointerUp={finishDraft}
                  onPointerCancel={() => setDraft(null)}
                >
                  <title>Drag to another lifeline to add a message</title>
                </rect>
              ))}

            {layout.rows.map((row) =>
              row.step.type === "message" ? (
                <MessageArrow
                  key={row.step.id}
                  message={row.step}
                  y={row.y}
                  layout={layout}
                  number={numbers?.get(row.step.id)}
                  selected={selected === row.step.id}
                />
              ) : (
                <NoteBox key={row.step.id} note={row.step} y={row.y} lines={row.lines ?? []} layout={layout} selected={selected === row.step.id} ink={ink} />
              ),
            )}

            {layout.columns.map((column) => (
              <ParticipantHead
                key={column.participant.id}
                participant={column.participant}
                x={column.x}
                width={column.width}
                color={colorOf(column.participant)}
                selected={selected === column.participant.id}
              />
            ))}

            {draft && <DraftLine draft={draft} layout={layout} column={columnOf(draft.from)?.x ?? draft.startX} />}
          </svg>
      </div>
      </div>
    </div>
  );
}

function ParticipantHead({
  participant,
  x,
  width,
  color,
  selected,
}: {
  participant: SequenceParticipant;
  x: number;
  width: number;
  color?: string;
  selected: boolean;
}) {
  const top = L.margin;
  const select = () => selectSequenceItem(participant.id);
  const common = {
    role: "button",
    tabIndex: 0,
    "aria-label": `${participant.label}${participant.shape === "actor" ? " (person)" : ""}`,
    className: "cursor-pointer outline-none",
    onClick: select,
    onDoubleClick: () => {
      select();
      showDetails(SEQUENCE_LABEL_FIELD_ID);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter") select();
    },
  } as const;

  if (participant.shape === "actor") {
    return (
      <g {...common} data-participant={participant.id}>
        {participant.description && <title>{participant.description}</title>}
        <rect x={x - width / 2} y={top} width={width} height={L.headerHeight} fill="transparent" stroke={selected ? SELECTED : "none"} strokeDasharray="4 3" rx={6} />
        <g fill="none" strokeWidth={1.75} strokeLinecap="round" stroke={color ?? "currentColor"}>
          <circle cx={x} cy={top + 6} r={5} />
          <path d={`M${x} ${top + 11}v9M${x - 7} ${top + 15}h14M${x} ${top + 20}l-6 7M${x} ${top + 20}l6 7`} />
        </g>
        <text x={x} y={top + L.headerHeight - 2} textAnchor="middle" fontSize={13} fontWeight={600} fill="currentColor">
          {participant.label}
        </text>
      </g>
    );
  }
  const fill = color ?? "#ffffff";
  return (
    <g {...common} data-participant={participant.id}>
      {participant.description && <title>{participant.description}</title>}
      <rect
        x={x - width / 2}
        y={top}
        width={width}
        height={L.headerHeight}
        rx={6}
        fill={fill}
        stroke={selected ? SELECTED : "rgba(0,0,0,0.25)"}
        strokeWidth={selected ? 2 : 1}
        strokeDasharray={color ? undefined : "4 3"}
      />
      <text x={x} y={top + L.headerHeight / 2} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600} fill={readableTextOn(fill)}>
        {participant.label}
      </text>
    </g>
  );
}

function arrowHead(x: number, y: number, direction: 1 | -1, filled: boolean, stroke: string) {
  const back = x - ARROW * direction;
  return filled ? (
    <path d={`M${x} ${y}L${back} ${y - ARROW / 2}L${back} ${y + ARROW / 2}Z`} fill={stroke} stroke={stroke} />
  ) : (
    <path d={`M${back} ${y - ARROW / 2}L${x} ${y}L${back} ${y + ARROW / 2}`} fill="none" stroke={stroke} strokeWidth={1.5} />
  );
}

function MessageArrow({
  message,
  y,
  layout,
  number,
  selected,
}: {
  message: SequenceMessage;
  y: number;
  layout: SequenceLayout;
  number?: number;
  selected: boolean;
}) {
  const from = layout.columns.find((column) => column.participant.id === message.from);
  const to = layout.columns.find((column) => column.participant.id === message.to);
  if (!from || !to) return null;
  const stroke = selected ? SELECTED : "currentColor";
  const dash = message.kind === "reply" ? "6 4" : undefined;
  const filled = (message.kind ?? "call") === "call";
  const caption = [number !== undefined ? `${number}.` : "", messageCaption(message)].filter(Boolean).join(" ");
  const select = () => selectSequenceItem(message.id);
  const handlers = {
    role: "button",
    tabIndex: 0,
    "aria-label": `Message ${caption || "without a label"}`,
    className: "cursor-pointer outline-none",
    onClick: select,
    onDoubleClick: () => {
      select();
      showDetails(SEQUENCE_LABEL_FIELD_ID);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter") select();
    },
  } as const;

  if (from === to) {
    const x = from.x;
    const right = x + L.selfLoop;
    return (
      <g {...handlers} data-step={message.id}>
        <rect x={x} y={y - 18} width={L.selfLoop + 12} height={44} fill="transparent" />
        <path d={`M${x} ${y}H${right}V${y + 24}H${x + ARROW}`} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} />
        {arrowHead(x, y + 24, -1, filled, stroke)}
        <text x={right + 6} y={y + 12} dominantBaseline="central" fontSize={12} fill={selected ? SELECTED : "currentColor"}>
          {caption}
        </text>
      </g>
    );
  }

  const direction = to.x > from.x ? 1 : -1;
  return (
    <g {...handlers} data-step={message.id}>
      <rect x={Math.min(from.x, to.x)} y={y - 22} width={Math.abs(to.x - from.x)} height={30} fill="transparent" />
      <line x1={from.x} x2={to.x - ARROW * direction} y1={y} y2={y} stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} />
      {arrowHead(to.x, y, direction, filled, stroke)}
      <text x={(from.x + to.x) / 2} y={y - 7} textAnchor="middle" fontSize={12} fill={selected ? SELECTED : "currentColor"}>
        {caption}
      </text>
    </g>
  );
}

function NoteBox({
  note,
  y,
  lines,
  layout,
  selected,
  ink,
}: {
  note: SequenceNote;
  y: number;
  lines: string[];
  layout: SequenceLayout;
  selected: boolean;
  ink: Ink;
}) {
  const xs = note.over.flatMap((id) => layout.columns.find((column) => column.participant.id === id)?.x ?? []);
  if (!xs.length) return null;
  const left = xs.length > 1 ? Math.min(...xs) - 60 : xs[0] - L.noteWidth / 2;
  const right = xs.length > 1 ? Math.max(...xs) + 60 : xs[0] + L.noteWidth / 2;
  const height = lines.length * L.noteLine + L.notePadding * 2;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Note: ${note.text}`}
      data-step={note.id}
      className="cursor-pointer outline-none"
      onClick={() => selectSequenceItem(note.id)}
      onDoubleClick={() => {
        selectSequenceItem(note.id);
        showDetails(SEQUENCE_LABEL_FIELD_ID);
      }}
      onKeyDown={(event) => event.key === "Enter" && selectSequenceItem(note.id)}
    >
      <rect
        x={left}
        y={y}
        width={right - left}
        height={height}
        rx={4}
        strokeWidth={selected ? 2 : 1}
        stroke={selected ? SELECTED : ink.noteStroke}
        fill={ink.noteFill}
      />
      {lines.map((line, index) => (
        <text key={index} x={(left + right) / 2} y={y + L.notePadding + L.noteLine * index + 12} textAnchor="middle" fontSize={12} fill={ink.noteText}>
          {line}
        </text>
      ))}
    </g>
  );
}

function DraftLine({ draft, layout, column }: { draft: Draft; layout: SequenceLayout; column: number }) {
  const target = columnAt(layout, draft.x);
  const moved = Math.hypot(draft.x - draft.startX, draft.pointerY - draft.y) >= DRAG_THRESHOLD;
  if (!moved || !target) return null;
  const self = target.participant.id === draft.from;
  return (
    <g pointerEvents="none" stroke={SELECTED} fill="none" strokeWidth={2}>
      {self ? (
        <path d={`M${column} ${draft.y}H${column + L.selfLoop}V${draft.y + 24}H${column}`} strokeDasharray="5 4" />
      ) : (
        <line x1={column} x2={target.x} y1={draft.y} y2={draft.y} strokeDasharray="5 4" />
      )}
      <circle cx={target.x} cy={self ? draft.y + 24 : draft.y} r={5} fill={SELECTED} />
    </g>
  );
}
