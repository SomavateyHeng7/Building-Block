"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { readableTextOn } from "@/lib/diagram/palette";
import {
  ACTIVATION_WIDTH,
  FRAME_TAB,
  SEQUENCE_LAYOUT as L,
  addParticipant,
  addStep,
  columnAt,
  estimateTextWidth,
  layoutSequence,
  messageCaption,
  messageNumbers,
  moveParticipant,
  moveStep,
  newBlock,
  newMessage,
  newNote,
  newParticipant,
  splitCaption,
  stepIndexAt,
  updateParticipant,
  updateStep,
  wrapSteps,
  type SequenceFrame,
  type SequenceLayout,
} from "@/lib/diagram/sequence/sequence";
import type { SequenceBlockKind, SequenceDiagram, SequenceMessage, SequenceNote, SequenceParticipant } from "@/lib/diagram/types";
import { useSequenceCode } from "./SequenceCode";
import { Icon } from "../shared/Icon";
import { selectSequenceItem, useSequenceSelection } from "./sequenceSelection";
import { useReadOnly } from "../shared/viewMode";

const EMPTY: SequenceDiagram = { participants: [], steps: [] };
/** Pointer travel below this is a click, not a drag. */
const DRAG_THRESHOLD = 8;
const ARROW = 9;
const SELECTED = "#2563eb";

const FONT = '"trebuchet ms", verdana, arial, sans-serif';

/**
 * Mermaid's own sequence look (its default and dark themes), so the sheet reads like the code beside it rather
 * than like an architecture tab. Colours are SVG attributes, not Tailwind classes: the picture export copies the
 * sheet, and classes on SVG elements don't come through (lifelines vanished and notes turned black).
 */
const INK = {
  light: {
    sheet: "#ffffff",
    text: "#333333",
    line: "#333333",
    lifeline: "#999999",
    actorFill: "#ececff",
    actorStroke: "#9370db",
    actorText: "#000000",
    noteFill: "#fff5ad",
    noteStroke: "#aaaa33",
    noteText: "#333333",
    numberFill: "#333333",
    numberText: "#ffffff",
    frameStroke: "#9370db",
    frameTab: "#ececff",
    frameText: "#000000",
    activationFill: "#f4f4f4",
    activationStroke: "#666666",
  },
  dark: {
    sheet: "#1e1e1e",
    text: "#cccccc",
    line: "#d3d3d3",
    lifeline: "#6b6b6b",
    actorFill: "#1f2020",
    actorStroke: "#81b1db",
    actorText: "#e0e0e0",
    noteFill: "#fff5ad",
    noteStroke: "#aaaa33",
    noteText: "#333333",
    numberFill: "#d3d3d3",
    numberText: "#1e1e1e",
    frameStroke: "#81b1db",
    frameTab: "#1f2020",
    frameText: "#e0e0e0",
    activationFill: "#2b2b2b",
    activationStroke: "#a0a0a0",
  },
};

/** Mermaid's frames, with what each is for (shown as the button's tooltip). */
export const FRAME_KINDS: { kind: SequenceBlockKind; label: string; hint: string }[] = [
  { kind: "loop", label: "Loop", hint: "Repeated: e.g. every minute, for each item" },
  { kind: "alt", label: "Alt", hint: "Alternatives: if … else …" },
  { kind: "opt", label: "Opt", hint: "Optional: only happens if …" },
  { kind: "par", label: "Par", hint: "In parallel: … and …" },
  { kind: "critical", label: "Critical", hint: "Must succeed together, with what happens if not" },
  { kind: "break", label: "Break", hint: "Stops the flow: e.g. when a check fails" },
];

const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];

/** Text being written on the sheet, in a field over what it edits (sheet pixels, before zoom). */
interface Editing {
  id: string;
  value: string;
  x: number;
  y: number;
  width: number;
  multiline?: boolean;
  placeholder?: string;
}

/** Where the field for editing an item's text goes, and what it starts with. */
function editingFor(sequence: SequenceDiagram, layout: SequenceLayout, id: string): Editing | null {
  const column = layout.columns.find((candidate) => candidate.participant.id === id);
  if (column) {
    if (column.participant.component) return null;
    return { id, value: column.participant.label, x: column.x - Math.max(column.width, 140) / 2, y: L.margin + 8, width: Math.max(column.width, 140) };
  }
  const row = layout.rows.find((candidate) => candidate.step.id === id);
  if (!row) return null;
  const step = row.step;
  if (step.type === "message") {
    const from = row.fromX ?? 0;
    const to = row.toX ?? 0;
    const width = Math.max(180, Math.abs(to - from) - 16);
    const center = from === to || step.from === step.to ? from + L.selfLoop + 6 + width / 2 : (from + to) / 2;
    return { id, value: messageCaption(step), x: center - width / 2, y: (step.from === step.to ? row.y : row.y - 30), width, placeholder: "What's sent (protocol)" };
  }
  if (step.type === "note") {
    const xs = step.over.flatMap((over) => layout.columns.find((candidate) => candidate.participant.id === over)?.x ?? []);
    const left = xs.length > 1 ? Math.min(...xs) - 60 : (xs[0] ?? 0) - L.noteWidth / 2;
    const right = xs.length > 1 ? Math.max(...xs) + 60 : (xs[0] ?? 0) + L.noteWidth / 2;
    return { id, value: step.text, x: left, y: row.y, width: right - left, multiline: true };
  }
  if (step.type === "block" || step.type === "else") {
    const frame =
      step.type === "block"
        ? layout.frames.find((candidate) => candidate.block.id === id)
        : layout.frames.find((candidate) => candidate.dividers.some((divider) => divider.id === id));
    if (!frame) return null;
    const x = step.type === "block" ? frame.left + estimateTextWidth(frame.block.kind) + FRAME_TAB.padding * 2 + 4 : frame.left + 8;
    return { id, value: step.label ?? "", x, y: (step.type === "block" ? frame.top : row.y) - 2, width: Math.max(160, frame.right - x - 8), placeholder: "Condition, e.g. Payment approved" };
  }
  void sequence;
  return null;
}
type Ink = (typeof INK)["light"];

/** A message being drawn: dragged from one lifeline towards another. */
interface Draft {
  from: string;
  startX: number;
  y: number;
  x: number;
  pointerY: number;
}

/** A participant being dragged along the top, or a message or note up or down the page (sheet pixels). */
interface Moving {
  kind: "participant" | "step";
  id: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

/** Where a participant dragged to `x` ends up: after every other participant left of it. */
function participantDropIndex(layout: SequenceLayout, id: string, x: number): number {
  return layout.columns.filter((column) => column.participant.id !== id && column.x < x).length;
}

/** Where a step dragged to `y` ends up: after every other step whose middle is above it. */
function stepDropIndex(layout: SequenceLayout, id: string, y: number): number {
  return layout.rows.filter((row) => row.step.id !== id && row.top + row.height / 2 < y).length;
}

/** The insertion line for a drag in progress: between the columns or rows it would land between. */
function DropMarker({ moving, layout }: { moving: Moving; layout: SequenceLayout }) {
  if (moving.kind === "participant") {
    const others = layout.columns.filter((column) => column.participant.id !== moving.id);
    if (!others.length) return null;
    const index = participantDropIndex(layout, moving.id, moving.x);
    const before = others[index - 1];
    const after = others[index];
    const x = !before ? after.x - after.width / 2 - 10 : !after ? before.x + before.width / 2 + 10 : (before.x + after.x) / 2;
    return <line x1={x} x2={x} y1={L.margin} y2={layout.lifelineBottom + L.headerHeight} stroke={SELECTED} strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />;
  }
  const others = layout.rows.filter((row) => row.step.id !== moving.id);
  const index = stepDropIndex(layout, moving.id, moving.y);
  const last = others[others.length - 1];
  const y = others[index]?.top ?? (last ? last.top + last.height : layout.lifelineTop + 10);
  const left = layout.columns[0]?.x ?? 0;
  const right = layout.columns[layout.columns.length - 1]?.x ?? left;
  return <line x1={left - 30} x2={right + 30} y1={y} y2={y} stroke={SELECTED} strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />;
}

/**
 * A sequence tab: participants across the top, steps down the page, laid out from the content (see
 * `layoutSequence`). Drag from one lifeline to another to add a message where you let go; drag a participant
 * sideways or a message or note up or down to move it; drag the empty sheet to scroll. Click anything to edit it
 * in the Mermaid code. Drawn as SVG at 1:1, so the export takes the same picture (`.bb-sequence-sheet`).
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
  const [moving, setMoving] = useState<Moving | null>(null);
  const [panning, setPanning] = useState(false);
  // A drag just ended: the click that follows it isn't a click on the background (which would clear the selection).
  const justDragged = useRef(false);
  const stopFollowing = useRef<(() => void) | null>(null);
  useEffect(() => () => stopFollowing.current?.(), []);
  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState<Editing | null>(null);
  // Something new was added and asked to be named: open its field once it's laid out.
  const [nameNext, setNameNext] = useState<string | null>(null);
  // Settled while rendering (React's "adjust state when props change"): the new item is in this render's layout.
  if (nameNext && !readOnly) {
    const next = editingFor(sequence, layout, nameNext);
    setNameNext(null);
    if (next) setEditing(next);
  }

  /** Opens the field for writing an item's name, label or text on the sheet. */
  function startEditing(id: string) {
    if (readOnly) return;
    selectSequenceItem(id);
    const next = editingFor(sequence, layout, id);
    if (next) setEditing(next);
    else useSequenceCode.getState().reveal(id);
  }

  function commitEditing(value: string) {
    const current = editing;
    setEditing(null);
    if (!current) return;
    const participant = sequence.participants.find((candidate) => candidate.id === current.id);
    if (participant) {
      if (value.trim() && value !== participant.label) updateSequence((seq) => updateParticipant(seq, current.id, { label: value.trim() }));
      return;
    }
    const step = sequence.steps.find((candidate) => candidate.id === current.id);
    if (!step) return;
    if (step.type === "message") {
      const { label, protocol } = splitCaption(value);
      updateSequence((seq) => updateStep(seq, step.id, { label: label ?? "", protocol: protocol ?? "" }));
    } else if (step.type === "note") {
      if (value.trim()) updateSequence((seq) => updateStep(seq, step.id, { text: value }));
    } else if (step.type === "block" || step.type === "else") {
      updateSequence((seq) => ({
        ...seq,
        steps: seq.steps.map((candidate) => {
          if (candidate.id !== step.id || (candidate.type !== "block" && candidate.type !== "else")) return candidate;
          const { label: _old, ...rest } = candidate;
          void _old;
          return value.trim() ? { ...rest, label: value.trim() } : rest;
        }),
      }));
    }
  }

  const colorOf = (participant: SequenceParticipant) => legend.find((entry) => entry.key === participant.colorKey)?.color;
  const columnOf = (id: string) => layout.columns.find((column) => column.participant.id === id);

  /** Pointer position in sheet pixels (the sheet may be zoomed). */
  function local(event: { clientX: number; clientY: number }) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  }

  /**
   * Follows the pointer on the window until it's let go, so a drag keeps going off the item (or the sheet) it
   * started on. No pointer capture: that would retarget the click after it, and clicks still select.
   */
  function follow(onMove: (event: PointerEvent) => void, onUp: (event: PointerEvent) => void) {
    stopFollowing.current?.();
    const up = (event: PointerEvent) => {
      stop();
      onUp(event);
    };
    const cancel = () => {
      stop();
      setMoving(null);
      setPanning(false);
    };
    function stop() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      stopFollowing.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    stopFollowing.current = stop;
  }

  function markDragged() {
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 0);
  }

  /** Press on a participant or a step: past the threshold it's a move, otherwise the click it was. */
  function grab(event: ReactPointerEvent, kind: Moving["kind"], id: string) {
    if (readOnly || event.button !== 0 || editing) return;
    const start = local(event);
    let current: Moving | null = null;
    follow(
      (move) => {
        const point = local(move);
        if (!current && Math.hypot(point.x - start.x, point.y - start.y) < DRAG_THRESHOLD) return;
        current = { kind, id, startX: start.x, startY: start.y, ...point };
        setMoving(current);
      },
      (up) => {
        if (!current) return;
        setMoving(null);
        markDragged();
        const point = local(up);
        updateSequence((seq) =>
          kind === "participant"
            ? moveParticipant(seq, id, participantDropIndex(layout, id, point.x))
            : moveStep(seq, id, stepDropIndex(layout, id, point.y)),
        );
        selectSequenceItem(id);
      },
    );
  }

  /** Press on the empty sheet (or around it): drag to scroll, like a hand tool. The middle button works anywhere. */
  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    const svg = svgRef.current;
    const target = event.target as Element;
    const background = target === svg || (!svg?.contains(target) && !target.closest("input, textarea, button"));
    if (!(event.button === 1 || (event.button === 0 && background))) return;
    if (event.button === 1) event.preventDefault();
    const scroller = event.currentTarget;
    const start = { x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
    let moved = false;
    follow(
      (move) => {
        const dx = move.clientX - start.x;
        const dy = move.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!moved) setPanning(true);
        moved = true;
        scroller.scrollLeft = start.left - dx;
        scroller.scrollTop = start.top - dy;
      },
      () => {
        if (!moved) return;
        setPanning(false);
        markDragged();
      },
    );
  }

  /** How far the item being moved is drawn from where it sits. */
  const offsetOf = (kind: Moving["kind"], id: string) =>
    moving && moving.kind === kind && moving.id === id ? (kind === "participant" ? `translate(${moving.x - moving.startX} 0)` : `translate(0 ${moving.y - moving.startY})`) : undefined;

  function addFirst(shape: SequenceParticipant["shape"]) {
    const participant = newParticipant(shape === "actor" ? "User" : "New participant", shape);
    updateSequence((current) => addParticipant(current, participant));
    selectSequenceItem(participant.id);
    setNameNext(participant.id);
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
    setNameNext(message.id);
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
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                onClick={() => useSequenceCode.getState().reveal()}
              >
                <Icon name="code" />
                Write Mermaid code
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-[#1e1e1e]">
      {!readOnly && <SequenceToolbar sequence={sequence} zoom={zoom} onZoom={setZoom} onAdded={setNameNext} />}
      {readOnly && <ZoomControls zoom={zoom} onZoom={setZoom} className="absolute right-3 top-3 z-10" />}
    <div
      className={`min-h-0 flex-1 overflow-auto ${panning ? "cursor-grabbing" : "cursor-grab"}`}
      onPointerDown={startPan}
      onClick={(event) => {
        if (event.target === event.currentTarget && !justDragged.current) selectSequenceItem(null);
      }}
    >
      {/* The sheet is what exports picture, so spacing and zoom sit on these wrappers, not on it. */}
      <div className="m-4 w-max" style={{ width: layout.width * zoom, height: layout.height * zoom }}>
        <div className="relative origin-top-left" style={{ transform: zoom === 1 ? undefined : `scale(${zoom})`, width: layout.width }}>
        <div className="bb-sequence-sheet" style={{ width: layout.width, height: layout.height, background: ink.sheet }}>
          <svg
            ref={svgRef}
            // A group, not an image: it holds the participants, messages and notes people click and tab to.
            role="group"
            aria-label={`Sequence diagram: ${sequence.participants.length} participants, ${sequence.steps.filter((step) => step.type === "message" || step.type === "note").length} steps, ${layout.frames.length} frames`}
            width={layout.width}
            height={layout.height}
            className={`block select-none ${moving ? "cursor-grabbing" : ""}`}
            color={ink.text}
            fontFamily={FONT}
            onClick={(event) => {
              if (event.target === event.currentTarget && !justDragged.current) selectSequenceItem(null);
            }}
          >
            {layout.columns.map((column) => (
              <line
                key={column.participant.id}
                x1={column.x}
                x2={column.x}
                y1={layout.lifelineTop}
                y2={layout.lifelineBottom}
                stroke={ink.lifeline}
                strokeWidth={1}
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

            {layout.frames.map((frame) => (
              <FrameBox key={frame.block.id} frame={frame} ink={ink} selected={selected} onEdit={startEditing} layer="box" />
            ))}

            {layout.activations.map((bar, index) => (
              <rect
                key={`${bar.participantId}-${index}`}
                x={bar.x}
                y={bar.top}
                width={ACTIVATION_WIDTH}
                height={Math.max(4, bar.bottom - bar.top)}
                fill={ink.activationFill}
                stroke={ink.activationStroke}
                strokeWidth={1}
                pointerEvents="none"
              />
            ))}

            {layout.rows.map((row) =>
              row.step.type === "message" || row.step.type === "note" ? (
                <g key={row.step.id} transform={offsetOf("step", row.step.id)} opacity={offsetOf("step", row.step.id) ? 0.75 : undefined}>
                  {row.step.type === "message" ? (
                    <MessageArrow
                      message={row.step}
                      y={row.y}
                      fromX={row.fromX}
                      toX={row.toX}
                      number={numbers?.get(row.step.id)}
                      selected={selected === row.step.id}
                      hidden={editing?.id === row.step.id}
                      ink={ink}
                      onEdit={startEditing}
                      onGrab={readOnly ? undefined : (event) => grab(event, "step", row.step.id)}
                    />
                  ) : (
                    <NoteBox
                      note={row.step}
                      y={row.y}
                      lines={row.lines ?? []}
                      layout={layout}
                      selected={selected === row.step.id}
                      ink={ink}
                      onEdit={startEditing}
                      onGrab={readOnly ? undefined : (event) => grab(event, "step", row.step.id)}
                    />
                  )}
                </g>
              ) : null,
            )}

            {/* Frame tabs and conditions go over the bars and arrows, so they're never covered. */}
            {layout.frames.map((frame) => (
              <FrameBox key={frame.block.id} frame={frame} ink={ink} selected={selected} onEdit={startEditing} layer="labels" editing={editing?.id ?? null} />
            ))}

            {[L.margin, layout.lifelineBottom].map((top, index) =>
              layout.columns.map((column) => (
                <g
                  key={`${index}-${column.participant.id}`}
                  transform={offsetOf("participant", column.participant.id)}
                  opacity={offsetOf("participant", column.participant.id) ? 0.75 : undefined}
                >
                  <ParticipantHead
                    participant={column.participant}
                    x={column.x}
                    top={top}
                    width={column.width}
                    color={colorOf(column.participant)}
                    selected={selected === column.participant.id}
                    mirror={index === 1}
                    ink={ink}
                    onEdit={startEditing}
                    onGrab={readOnly ? undefined : (event) => grab(event, "participant", column.participant.id)}
                  />
                </g>
              )),
            )}

            {draft && <DraftLine draft={draft} layout={layout} column={columnOf(draft.from)?.x ?? draft.startX} />}
            {moving && <DropMarker moving={moving} layout={layout} />}
          </svg>
        </div>
        {editing && <InlineEditor editing={editing} onCommit={commitEditing} onCancel={() => setEditing(null)} />}
        </div>
      </div>
    </div>
    </div>
  );
}

/** A field over the sheet for writing a name or label in place. Enter (Ctrl/⌘+Enter in a note) keeps it; Esc doesn't. */
function InlineEditor({ editing, onCommit, onCancel }: { editing: Editing; onCommit: (value: string) => void; onCancel: () => void }) {
  const done = useRef(false);
  const common = {
    autoFocus: true,
    defaultValue: editing.value,
    placeholder: editing.placeholder,
    "aria-label": "Edit text",
    className:
      "absolute z-20 rounded border-2 border-blue-500 bg-white px-1.5 py-0.5 text-center text-[13px] text-zinc-900 shadow-lg outline-none dark:bg-zinc-900 dark:text-zinc-100",
    style: { left: editing.x, top: editing.y, width: editing.width },
    onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => event.currentTarget.select(),
    onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!done.current) onCommit(event.currentTarget.value);
      done.current = true;
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // The sheet's own keys (arrows move, Delete removes) stay out of what's being written.
      event.stopPropagation();
      if (event.key === "Escape") {
        done.current = true;
        onCancel();
      } else if (event.key === "Enter" && (!editing.multiline || event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
  };
  return editing.multiline ? <textarea rows={3} {...common} /> : <input {...common} />;
}

const TOOL =
  "inline-flex min-h-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-200 dark:hover:bg-zinc-800";

function ZoomControls({ zoom, onZoom, className = "" }: { zoom: number; onZoom: (zoom: number) => void; className?: string }) {
  const at = ZOOMS.indexOf(zoom);
  return (
    <div className={`flex items-center rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 ${className}`}>
      <button type="button" className={TOOL} aria-label="Zoom out" disabled={at <= 0} onClick={() => onZoom(ZOOMS[at - 1])}>
        −
      </button>
      <button type="button" className={`${TOOL} w-12 justify-center tabular-nums`} title="Back to 100%" onClick={() => onZoom(1)}>
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className={TOOL} aria-label="Zoom in" disabled={at >= ZOOMS.length - 1} onClick={() => onZoom(ZOOMS[at + 1])}>
        +
      </button>
    </div>
  );
}

/**
 * Adds things where you'd expect: after what's selected (or at the end), from the selected participant. A new
 * message or note opens its label for typing straight away (`onAdded`).
 */
function SequenceToolbar({ sequence, zoom, onZoom, onAdded }: { sequence: SequenceDiagram; zoom: number; onZoom: (zoom: number) => void; onAdded: (id: string) => void }) {
  const updateSequence = useDiagramStore((state) => state.updateSequence);
  const selected = useSequenceSelection((state) => state.id);
  const [framesOpen, setFramesOpen] = useState(false);
  const { participants, steps } = sequence;
  const stepAt = steps.findIndex((step) => step.id === selected);
  const selectedStep = stepAt === -1 ? undefined : steps[stepAt];
  const selectedParticipant = participants.find((participant) => participant.id === selected);
  const insertAt = stepAt === -1 ? steps.length : stepAt + 1;

  function add(shape: SequenceParticipant["shape"]) {
    const participant = newParticipant(shape === "actor" ? "User" : `Participant ${participants.length + 1}`, shape);
    const index = selectedParticipant ? participants.indexOf(selectedParticipant) + 1 : participants.length;
    updateSequence((current) => addParticipant(current, participant, index));
    selectSequenceItem(participant.id);
    onAdded(participant.id);
  }

  /** From the selected participant, or the sender of the selected message, to the next one along. */
  function addMessage() {
    const fromId =
      selectedParticipant?.id ??
      (selectedStep?.type === "message" ? selectedStep.to : selectedStep?.type === "note" ? selectedStep.over[0] : undefined) ??
      participants[0].id;
    const fromIndex = participants.findIndex((participant) => participant.id === fromId);
    const to = participants[fromIndex + 1] ?? participants[fromIndex - 1] ?? participants[fromIndex];
    const message = newMessage(fromId, to.id);
    updateSequence((current) => addStep(current, message, insertAt));
    selectSequenceItem(message.id);
    onAdded(message.id);
  }

  function addNote() {
    const over =
      selectedParticipant?.id ?? (selectedStep?.type === "message" ? selectedStep.to : undefined) ?? participants[0].id;
    const note = newNote([over], "Note");
    updateSequence((current) => addStep(current, note, insertAt));
    selectSequenceItem(note.id);
    onAdded(note.id);
  }

  /** Wraps the selected message or note in a frame, or adds an empty one after the selection. */
  function addFrame(kind: SequenceBlockKind) {
    setFramesOpen(false);
    const block = newBlock(kind);
    const wrap = selectedStep && (selectedStep.type === "message" || selectedStep.type === "note");
    updateSequence((current) => (wrap ? wrapSteps(current, block, stepAt, stepAt) : wrapSteps(current, block, insertAt)));
    selectSequenceItem(block.id);
    onAdded(block.id);
  }

  const wrapping = selectedStep?.type === "message" || selectedStep?.type === "note";
  return (
    <div role="toolbar" aria-label="Add to the sequence" className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-white px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950">
      <button type="button" className={TOOL} onClick={() => add("participant")} title="Add a participant (after the selected one)">
        <Icon name="plus" className="h-3.5 w-3.5" /> Participant
      </button>
      <button type="button" className={TOOL} onClick={() => add("actor")} title="Add a person">
        <Icon name="user" className="h-3.5 w-3.5" /> Actor
      </button>
      <span aria-hidden className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
      <button type="button" className={TOOL} onClick={addMessage} title="Add a message after the selection, or drag between lifelines">
        <Icon name="swap" className="h-3.5 w-3.5" /> Message
      </button>
      <button type="button" className={TOOL} onClick={addNote} title="Add a note after the selection">
        <Icon name="pencil" className="h-3.5 w-3.5" /> Note
      </button>
      <div className="relative">
        <button
          type="button"
          className={TOOL}
          aria-haspopup="menu"
          aria-expanded={framesOpen}
          onClick={() => setFramesOpen((open) => !open)}
          title={wrapping ? "Put the selected step in a frame (loop, alt…)" : "Add a frame (loop, alt…) after the selection"}
        >
          <Icon name="layers" className="h-3.5 w-3.5" /> Frame
          <Icon name="chevronDown" className="h-3 w-3" />
        </button>
        {framesOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            onKeyDown={(event) => event.key === "Escape" && setFramesOpen(false)}
          >
            <p className="px-2 py-1 text-[11px] text-zinc-500">{wrapping ? "Put the selected step in:" : "Add after the selection:"}</p>
            {FRAME_KINDS.map((frame) => (
              <button
                key={frame.kind}
                type="button"
                role="menuitem"
                className="flex w-full flex-col items-start rounded px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => addFrame(frame.kind)}
              >
                <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">{frame.kind}</span>
                <span className="text-[11px] text-zinc-500">{frame.hint}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <span aria-hidden className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
      <label className={`${TOOL} cursor-pointer`} title="Mermaid's autonumber">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-zinc-900 dark:accent-zinc-100"
          checked={sequence.numbered !== false}
          onChange={(event) =>
            updateSequence((current) => {
              const next = { ...current };
              if (event.target.checked) delete next.numbered;
              else next.numbered = false;
              return next;
            })
          }
        />
        Number
      </label>
      <span className="ml-auto hidden text-[11px] text-zinc-400 2xl:inline">Double-click to rename · drag between lifelines for a message · drag a box, message or note to move it</span>
      <ZoomControls zoom={zoom} onZoom={onZoom} className="ml-auto 2xl:ml-2" />
    </div>
  );
}

/**
 * A Mermaid frame: a box round its steps with a tab saying what it is ("loop"), its condition in brackets, and a
 * dashed line before each further part ("[else …]").
 */
function FrameBox({
  frame,
  ink,
  selected,
  onEdit,
  layer,
  editing = null,
}: {
  frame: SequenceFrame;
  ink: Ink;
  selected: string | null;
  onEdit: (id: string) => void;
  /** The box and dividers go under the steps; the tab and conditions over them. */
  layer: "box" | "labels";
  editing?: string | null;
}) {
  const isSelected = selected === frame.block.id;
  const stroke = isSelected ? SELECTED : ink.frameStroke;
  const tabWidth = estimateTextWidth(frame.block.kind) + FRAME_TAB.padding * 2;
  const { left, right, top, bottom } = frame;
  const select = (id: string) => () => selectSequenceItem(id);
  const label = (text: string | undefined, x: number, y: number, id: string): ReactNode =>
    editing === id ? null : (
    <text
      x={x}
      y={y}
      fontSize={13}
      fontWeight={600}
      fill={isSelected ? SELECTED : ink.frameText}
      dominantBaseline="central"
      className="cursor-text"
      onClick={select(id)}
      onDoubleClick={() => onEdit(id)}
    >
      {text ? `[${text}]` : "[ ]"}
    </text>
  );
  if (layer === "box") {
    return (
      <g data-step={frame.block.id}>
        <rect x={left} y={top} width={right - left} height={bottom - top} fill="none" stroke={stroke} strokeWidth={isSelected ? 2 : 1.5} pointerEvents="none" />
        {frame.dividers.map((divider) => (
          <g key={divider.id} data-step={divider.id}>
            <line x1={left} x2={right} y1={divider.y} y2={divider.y} stroke={selected === divider.id ? SELECTED : ink.frameStroke} strokeWidth={1.5} strokeDasharray="6 4" />
            {/* A wide strip, so the dashed line is easy to click. */}
            <rect x={left} y={divider.y - 4} width={right - left} height={8} fill="transparent" className="cursor-pointer" onClick={select(divider.id)} onDoubleClick={() => onEdit(divider.id)} />
          </g>
        ))}
      </g>
    );
  }
  return (
    <g>
      <g
        role="button"
        tabIndex={0}
        aria-label={`${frame.block.kind} frame${frame.block.label ? `: ${frame.block.label}` : ""}`}
        className="cursor-pointer outline-none"
        onClick={select(frame.block.id)}
        onDoubleClick={() => onEdit(frame.block.id)}
        onKeyDown={(event) => event.key === "Enter" && selectSequenceItem(frame.block.id)}
      >
        <path
          d={`M${left} ${top}H${left + tabWidth}V${top + FRAME_TAB.height - 6}L${left + tabWidth - 6} ${top + FRAME_TAB.height}H${left}Z`}
          fill={ink.frameTab}
          stroke={stroke}
          strokeWidth={1}
        />
        <text x={left + tabWidth / 2} y={top + FRAME_TAB.height / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={ink.frameText}>
          {frame.block.kind}
        </text>
      </g>
      {label(frame.block.label, left + tabWidth + 8, top + FRAME_TAB.height / 2, frame.block.id)}
      {frame.dividers.map((divider) => (
        <g key={divider.id}>{label(divider.label, left + 8, divider.y + 12, divider.id)}</g>
      ))}
    </g>
  );
}

/** A participant's box; Mermaid repeats it under the lifeline (`mirror`), which only the mouse reaches. */
function ParticipantHead({
  participant,
  x,
  top,
  width,
  color,
  selected,
  mirror,
  ink,
  onEdit,
  onGrab,
}: {
  participant: SequenceParticipant;
  x: number;
  top: number;
  width: number;
  color?: string;
  selected: boolean;
  mirror: boolean;
  ink: Ink;
  onEdit: (id: string) => void;
  /** Press to start dragging it sideways. */
  onGrab?: (event: ReactPointerEvent) => void;
}) {
  const select = () => selectSequenceItem(participant.id);
  const common = {
    ...(mirror
      ? { "aria-hidden": true }
      : {
          role: "button",
          tabIndex: 0,
          "aria-label": `${participant.label}${participant.shape === "actor" ? " (person)" : ""}`,
          "data-participant": participant.id,
        }),
    className: `${onGrab ? "cursor-grab" : "cursor-pointer"} outline-none`,
    onPointerDown: onGrab,
    onClick: select,
    onDoubleClick: () => onEdit(participant.id),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter") select();
      if (event.key === "F2") onEdit(participant.id);
    },
  } as const;

  if (participant.shape === "actor") {
    return (
      <g {...common}>
        {participant.description && <title>{participant.description}</title>}
        <rect x={x - width / 2} y={top} width={width} height={L.headerHeight} fill="transparent" stroke={selected ? SELECTED : "none"} strokeDasharray="4 3" rx={3} />
        <g fill={color ?? ink.actorFill} strokeWidth={1.5} strokeLinecap="round" stroke={ink.actorStroke}>
          <circle cx={x} cy={top + 6} r={5} />
          <path fill="none" d={`M${x} ${top + 11}v9M${x - 7} ${top + 15}h14M${x} ${top + 20}l-6 7M${x} ${top + 20}l6 7`} />
        </g>
        <text x={x} y={top + L.headerHeight - 2} textAnchor="middle" fontSize={14} fill={ink.actorText}>
          {participant.label}
        </text>
      </g>
    );
  }
  return (
    <g {...common}>
      {participant.description && <title>{participant.description}</title>}
      <rect
        x={x - width / 2}
        y={top}
        width={width}
        height={L.headerHeight}
        rx={3}
        fill={color ?? ink.actorFill}
        stroke={selected ? SELECTED : ink.actorStroke}
        strokeWidth={selected ? 2 : 1}
      />
      <text
        x={x}
        y={top + L.headerHeight / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fill={color ? readableTextOn(color) : ink.actorText}
      >
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
  fromX,
  toX,
  number,
  selected,
  hidden,
  ink,
  onEdit,
  onGrab,
}: {
  message: SequenceMessage;
  y: number;
  /** Where the arrow starts and ends (at an activation bar's edge when there is one). */
  fromX?: number;
  toX?: number;
  number?: number;
  selected: boolean;
  /** Its caption is being edited in place. */
  hidden: boolean;
  ink: Ink;
  onEdit: (id: string) => void;
  /** Press to start dragging it up or down. */
  onGrab?: (event: ReactPointerEvent) => void;
}) {
  if (fromX === undefined || toX === undefined) return null;
  const from = { x: fromX };
  const to = { x: toX };
  const self = message.from === message.to;
  const stroke = selected ? SELECTED : ink.line;
  const dash = message.kind === "reply" ? "3 3" : undefined;
  const filled = (message.kind ?? "call") === "call";
  const label = hidden ? "" : messageCaption(message) || (selected ? "Double-click to name" : "");
  const caption = [number !== undefined ? `${number}.` : "", label].filter(Boolean).join(" ");
  // Mermaid's autonumber: the number in a dot where the arrow starts, not in the caption.
  const badge =
    number !== undefined ? (
      <g>
        <circle cx={from.x} cy={y} r={8} fill={selected ? SELECTED : ink.numberFill} />
        <text x={from.x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill={ink.numberText}>
          {number}
        </text>
      </g>
    ) : null;
  const select = () => selectSequenceItem(message.id);
  const handlers = {
    role: "button",
    tabIndex: 0,
    "aria-label": `Message ${caption || "without a label"}`,
    className: `${onGrab ? "cursor-grab" : "cursor-pointer"} outline-none`,
    onPointerDown: onGrab,
    onClick: select,
    onDoubleClick: () => onEdit(message.id),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter") select();
      if (event.key === "F2") onEdit(message.id);
    },
  } as const;

  if (self) {
    const x = from.x;
    const end = to.x;
    const right = Math.max(x, end) + L.selfLoop;
    return (
      <g {...handlers} data-step={message.id}>
        <rect x={x} y={y - 18} width={L.selfLoop + 12} height={44} fill="transparent" />
        <path d={`M${x} ${y}H${right}V${y + 24}H${end + ARROW}`} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} />
        {arrowHead(end, y + 24, -1, filled, stroke)}
        <text x={right + 6} y={y + 12} dominantBaseline="central" fontSize={13} fill={selected ? SELECTED : ink.text}>
          {label}
        </text>
        {badge}
      </g>
    );
  }

  const direction = to.x > from.x ? 1 : -1;
  return (
    <g {...handlers} data-step={message.id}>
      <rect x={Math.min(from.x, to.x)} y={y - 22} width={Math.abs(to.x - from.x)} height={30} fill="transparent" />
      <line x1={from.x} x2={to.x - ARROW * direction} y1={y} y2={y} stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} />
      {arrowHead(to.x, y, direction, filled, stroke)}
      <text x={(from.x + to.x) / 2} y={y - 7} textAnchor="middle" fontSize={13} fill={selected ? SELECTED : ink.text} fontStyle={messageCaption(message) ? undefined : "italic"}>
        {label}
      </text>
      {badge}
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
  onEdit,
  onGrab,
}: {
  note: SequenceNote;
  y: number;
  lines: string[];
  layout: SequenceLayout;
  selected: boolean;
  ink: Ink;
  onEdit: (id: string) => void;
  /** Press to start dragging it up or down. */
  onGrab?: (event: ReactPointerEvent) => void;
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
      className={`${onGrab ? "cursor-grab" : "cursor-pointer"} outline-none`}
      onPointerDown={onGrab}
      onClick={() => selectSequenceItem(note.id)}
      onDoubleClick={() => onEdit(note.id)}
      onKeyDown={(event) => event.key === "Enter" && selectSequenceItem(note.id)}
    >
      <rect
        x={left}
        y={y}
        width={right - left}
        height={height}
        strokeWidth={selected ? 2 : 1}
        stroke={selected ? SELECTED : ink.noteStroke}
        fill={ink.noteFill}
      />
      {/* One text, a tspan a line, with a space between: read out (and named) as the sentence it is, not "ifthe". */}
      <text textAnchor="middle" fontSize={13} fill={ink.noteText}>
        {lines.map((line, index) => (
          <tspan key={index} x={(left + right) / 2} y={y + L.notePadding + L.noteLine * index + 12}>
            {line}
            {index < lines.length - 1 ? " " : null}
          </tspan>
        ))}
      </text>
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
