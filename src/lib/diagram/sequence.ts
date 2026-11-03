import { createId } from "./factory";
import type {
  Diagram,
  SequenceBlock,
  SequenceBlockKind,
  DiagramNode,
  DiagramSection,
  SequenceDiagram,
  SequenceMessage,
  SequenceNote,
  SequenceParticipant,
  SequenceStep,
} from "./types";

/**
 * Sequence diagrams: participants left to right, steps (messages and notes) top to bottom. Everything here is
 * pure, so the store, the canvas, the importer and the tests share it. Positions aren't stored: the layout is
 * worked out from the content, so a sequence always reads in order and never needs tidying.
 */

export function emptySequence(): SequenceDiagram {
  return { participants: [], steps: [] };
}

export function newParticipant(label: string, shape: SequenceParticipant["shape"] = "participant", colorKey?: string): SequenceParticipant {
  return { id: createId("participant"), label, ...(shape === "actor" ? { shape } : {}), ...(colorKey ? { colorKey } : {}) };
}

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(length, index));
}

function moveItem<T extends { id: string }>(items: T[], id: string, index: number): T[] {
  const from = items.findIndex((item) => item.id === id);
  const to = clampIndex(index, items.length - 1);
  if (from === -1 || from === to) return items;
  const next = [...items];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

export function addParticipant(sequence: SequenceDiagram, participant: SequenceParticipant, index = sequence.participants.length): SequenceDiagram {
  const participants = [...sequence.participants];
  participants.splice(clampIndex(index, participants.length), 0, participant);
  return { ...sequence, participants };
}

export function updateParticipant(sequence: SequenceDiagram, id: string, patch: Partial<Omit<SequenceParticipant, "id">>): SequenceDiagram {
  return {
    ...sequence,
    participants: sequence.participants.map((participant) => (participant.id === id ? { ...participant, ...patch } : participant)),
  };
}

export function moveParticipant(sequence: SequenceDiagram, id: string, index: number): SequenceDiagram {
  const participants = moveItem(sequence.participants, id, index);
  return participants === sequence.participants ? sequence : { ...sequence, participants };
}

/** Removes a participant with its messages; notes over it lose it, and go when nothing is left under them. */
export function removeParticipant(sequence: SequenceDiagram, id: string): SequenceDiagram {
  return {
    ...sequence,
    participants: sequence.participants.filter((participant) => participant.id !== id),
    steps: sequence.steps.flatMap((step): SequenceStep[] => {
      if (step.type === "message") return step.from === id || step.to === id ? [] : [step];
      if (step.type !== "note") return [step];
      const over = step.over.filter((participantId) => participantId !== id);
      return over.length ? [{ ...step, over }] : [];
    }),
  };
}

export function addStep(sequence: SequenceDiagram, step: SequenceStep, index = sequence.steps.length): SequenceDiagram {
  const steps = [...sequence.steps];
  steps.splice(clampIndex(index, steps.length), 0, step);
  return { ...sequence, steps };
}

export function newMessage(from: string, to: string, fields: Partial<Omit<SequenceMessage, "id" | "type" | "from" | "to">> = {}): SequenceMessage {
  return { id: createId("message"), type: "message", from, to, ...fields };
}

export function newNote(over: string[], text: string): SequenceNote {
  return { id: createId("note"), type: "note", over, text };
}

/** Blank text is stored as undefined so it drops out of saved files. */
export function updateStep(
  sequence: SequenceDiagram,
  id: string,
  patch: Partial<Omit<SequenceMessage, "id" | "type">> | Partial<Omit<SequenceNote, "id" | "type">>,
): SequenceDiagram {
  const cleaned = Object.fromEntries(
    Object.entries(patch).map(([field, value]) => [field, field !== "text" && typeof value === "string" && !value.trim() ? undefined : value]),
  );
  return {
    ...sequence,
    steps: sequence.steps.map((step) => (step.id === id ? ({ ...step, ...cleaned } as SequenceStep) : step)),
  };
}

export function newBlock(kind: SequenceBlockKind, label?: string): SequenceBlock {
  return { id: createId("block"), type: "block", kind, ...(label ? { label } : {}) };
}

export function newElse(label?: string): SequenceStep {
  return { id: createId("else"), type: "else", ...(label ? { label } : {}) };
}

export function newEnd(): SequenceStep {
  return { id: createId("end"), type: "end" };
}

/** What Mermaid calls the next part of each kind of frame, where it has one. */
export const BLOCK_DIVIDER: Partial<Record<SequenceBlockKind, string>> = { alt: "else", par: "and", critical: "option" };

/**
 * Where a frame's markers are: the start, its own dividers and its end (indexes into `steps`), for a frame picked
 * by any of its markers. Undefined when `id` isn't a frame marker or the frame isn't closed.
 */
export function frameOf(steps: SequenceStep[], id: string): { start: number; dividers: number[]; end: number } | undefined {
  const open: { start: number; dividers: number[] }[] = [];
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    if (step.type === "block") open.push({ start: index, dividers: [] });
    else if (step.type === "else") open.at(-1)?.dividers.push(index);
    else if (step.type === "end") {
      const frame = open.pop();
      if (!frame) continue;
      const ids = [frame.start, ...frame.dividers, index].map((at) => steps[at].id);
      if (ids.includes(id)) return { ...frame, end: index };
    }
  }
  return undefined;
}

/**
 * Pairs frame markers up: drops an `else` or `end` with no frame open, and closes frames left open at the bottom.
 * Returns the same list when nothing needed fixing.
 */
export function balanceSteps(steps: SequenceStep[]): SequenceStep[] {
  let depth = 0;
  let changed = false;
  const kept = steps.filter((step) => {
    if (step.type === "block") depth += 1;
    else if (step.type === "else" || step.type === "end") {
      if (!depth) {
        changed = true;
        return false;
      }
      if (step.type === "end") depth -= 1;
    }
    return true;
  });
  if (!depth && !changed) return steps;
  for (; depth > 0; depth--) kept.push(newEnd());
  return kept;
}

/** Frame markers stay in order: a frame's start can't pass its own end (or a divider leave its frame). */
export function moveStep(sequence: SequenceDiagram, id: string, index: number): SequenceDiagram {
  const frame = frameOf(sequence.steps, id);
  const from = sequence.steps.findIndex((step) => step.id === id);
  let to = index;
  if (frame) {
    const markers = [frame.start, ...frame.dividers, frame.end];
    const position = markers.indexOf(from);
    const before = markers[position - 1];
    const after = markers[position + 1];
    if (before !== undefined) to = Math.max(to, before + 1);
    if (after !== undefined) to = Math.min(to, after - 1);
  }
  const steps = moveItem(sequence.steps, id, to);
  return steps === sequence.steps ? sequence : { ...sequence, steps: balanceSteps(steps) };
}

/** Removing any marker of a frame removes the whole frame (start, dividers and end); what was inside stays. */
export function removeStep(sequence: SequenceDiagram, id: string): SequenceDiagram {
  const frame = frameOf(sequence.steps, id);
  const gone = frame ? new Set([frame.start, ...frame.dividers, frame.end].map((at) => sequence.steps[at].id)) : new Set([id]);
  return { ...sequence, steps: balanceSteps(sequence.steps.filter((step) => !gone.has(step.id))) };
}

/**
 * Puts a frame around steps `from` to `to` (indexes, inclusive), or an empty one at `from` when `to` is before
 * it. An alt, par or critical frame gets its second part straight away, as it needs one to mean anything.
 */
export function wrapSteps(sequence: SequenceDiagram, block: SequenceBlock, from: number, to = from - 1): SequenceDiagram {
  const steps = [...sequence.steps];
  const start = clampIndex(from, steps.length);
  const end = clampIndex(to + 1, steps.length);
  const divider = BLOCK_DIVIDER[block.kind] ? [newElse()] : [];
  steps.splice(end, 0, ...divider, newEnd());
  steps.splice(start, 0, block);
  return { ...sequence, steps: balanceSteps(steps) };
}

/** "Place order (REST)" → what's sent and its protocol, the way captions are written on the sheet and in code. */
export function splitCaption(text: string): { label?: string; protocol?: string } {
  const trimmed = text.trim();
  const match = /^(.*?)\s*\(([^()]+)\)$/.exec(trimmed);
  if (!match) return trimmed ? { label: trimmed } : {};
  return { ...(match[1] ? { label: match[1] } : {}), protocol: match[2].trim() };
}

/** The number shown beside each message (notes aren't numbered). */
export function messageNumbers(sequence: SequenceDiagram): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const step of sequence.steps) if (step.type === "message") numbers.set(step.id, numbers.size + 1);
  return numbers;
}

/** What a message says on the diagram: "Place order (REST)", or whichever half exists. */
export function messageCaption(message: Pick<SequenceMessage, "label" | "protocol">): string {
  return [message.label, message.protocol && `(${message.protocol})`].filter(Boolean).join(" ");
}

// Layout, in canvas pixels. Text is measured by an estimate, so the layout is the same everywhere (including
// tests and exports) and doesn't depend on fonts having loaded.
export const SEQUENCE_LAYOUT = {
  margin: 32,
  headerHeight: 44,
  /** Space between the participant boxes and the first step. */
  firstGap: 28,
  rowHeight: 52,
  selfHeight: 68,
  /** How far a call to itself loops out to the right. */
  selfLoop: 36,
  noteWidth: 180,
  noteLine: 16,
  notePadding: 10,
  minBox: 120,
  maxBox: 220,
  minGap: 48,
  bottomGap: 32,
} as const;

const CHAR_WIDTH = 7;

export function estimateTextWidth(text: string): number {
  return Math.ceil(text.length * CHAR_WIDTH);
}

/** Splits text into lines of roughly `width` pixels, keeping words whole. */
export function wrapText(text: string, width: number): string[] {
  const perLine = Math.max(8, Math.floor(width / CHAR_WIDTH));
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && (line + " " + word).length > perLine) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export interface SequenceColumn {
  participant: SequenceParticipant;
  /** Centre of the box and its lifeline. */
  x: number;
  width: number;
}

export interface SequenceRow {
  step: SequenceStep;
  top: number;
  height: number;
  /** Where a message's arrow runs, a note's top, a frame's top or bottom edge, or a divider's line. */
  y: number;
  /** A note's lines, already wrapped. */
  lines?: string[];
  /** Where a message's arrow starts and ends: at the lifeline, or at the edge of an activation bar on it. */
  fromX?: number;
  toX?: number;
}

/** A frame around steps (`loop`, `alt`…), with the lines between its parts. */
export interface SequenceFrame {
  block: SequenceBlock;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** How many frames it's inside. */
  depth: number;
  dividers: { id: string; label?: string; y: number }[];
}

/** A participant being busy (Mermaid's activation): a narrow bar on its lifeline. */
export interface SequenceActivation {
  participantId: string;
  /** Left edge; bars inside bars sit a little to the right, as Mermaid draws them. */
  x: number;
  top: number;
  bottom: number;
}

export interface SequenceLayout {
  columns: SequenceColumn[];
  rows: SequenceRow[];
  frames: SequenceFrame[];
  activations: SequenceActivation[];
  /** Below the boxes, where the lifelines start; and where they end (the boxes repeat below, as Mermaid draws). */
  lifelineTop: number;
  lifelineBottom: number;
  width: number;
  height: number;
}

/** Activation bars are this wide; one inside another is moved right by half that. */
export const ACTIVATION_WIDTH = 10;
const FRAME_PAD = 14;
/** Room for the frame's name tab ("loop") before its label. */
export const FRAME_TAB = { height: 20, padding: 8 } as const;
const ROW = { block: 40, else: 32, end: 18 } as const;

/** How wide a frame's tab and label are, so the frame is at least that wide. */
export function frameLabelWidth(block: SequenceBlock): number {
  return estimateTextWidth(block.kind) + FRAME_TAB.padding * 2 + (block.label ? estimateTextWidth(`[${block.label}]`) + 12 : 0);
}

export function layoutSequence(sequence: SequenceDiagram): SequenceLayout {
  const first = layoutFrom(sequence, 0);
  // A frame round the first participant can reach past the margin: move everything right to make room.
  const margin = SEQUENCE_LAYOUT.margin;
  const left = Math.min(margin, ...first.frames.map((frame) => frame.left));
  return left < margin / 2 ? layoutFrom(sequence, margin / 2 - left) : first;
}

function layoutFrom(sequence: SequenceDiagram, shift: number): SequenceLayout {
  const L = SEQUENCE_LAYOUT;
  const { participants } = sequence;
  const steps = balanceSteps(sequence.steps);
  const index = new Map(participants.map((participant, position) => [participant.id, position]));
  const widths = participants.map((participant) =>
    Math.max(L.minBox, Math.min(L.maxBox, estimateTextWidth(participant.label) + 32)),
  );
  const numbers = sequence.numbered === false ? null : messageNumbers(sequence);
  const captionWidth = (message: SequenceMessage) =>
    estimateTextWidth(`${numbers ? `${numbers.get(message.id)}. ` : ""}${messageCaption(message)}`) + 24;

  // Each gap between neighbours is wide enough for the boxes, and for the captions of messages between them.
  const gaps = widths.slice(1).map((width, position) => (widths[position] + width) / 2 + L.minGap);
  for (const step of steps) {
    if (step.type !== "message") continue;
    const from = index.get(step.from);
    const to = index.get(step.to);
    if (from === undefined || to === undefined) continue;
    if (from === to) {
      if (from < gaps.length) gaps[from] = Math.max(gaps[from], L.selfLoop + captionWidth(step));
      continue;
    }
    const [left, right] = from < to ? [from, to] : [to, from];
    // Spread what a long caption needs over the gaps it crosses.
    const span = gaps.slice(left, right).reduce((sum, gap) => sum + gap, 0);
    const missing = captionWidth(step) - span;
    if (missing > 0) for (let gap = left; gap < right; gap++) gaps[gap] += missing / (right - left);
  }

  const columns: SequenceColumn[] = [];
  let x = L.margin + shift + (widths[0] ?? 0) / 2;
  participants.forEach((participant, position) => {
    columns.push({ participant, x, width: widths[position] });
    x += gaps[position] ?? 0;
  });
  const columnX = new Map(columns.map((column) => [column.participant.id, column.x]));

  // Activation bars: each participant has a stack of bars that are open.
  const open = new Map<string, number[]>();
  const activations: SequenceActivation[] = [];
  const barEdge = (id: string, depth: number, side: 1 | -1) => {
    const center = columnX.get(id) ?? 0;
    if (!depth) return center;
    const left = center - ACTIVATION_WIDTH / 2 + ((depth - 1) * ACTIVATION_WIDTH) / 2;
    return side > 0 ? left + ACTIVATION_WIDTH : left;
  };
  const closeBar = (id: string, bottom: number) => {
    const stack = open.get(id);
    const top = stack?.pop();
    if (top === undefined) return;
    const center = columnX.get(id) ?? 0;
    activations.push({ participantId: id, x: center - ACTIVATION_WIDTH / 2 + (stack!.length * ACTIVATION_WIDTH) / 2, top, bottom });
  };

  // Frames: each open one collects how far across its contents reach.
  interface OpenFrame { block: SequenceBlock; top: number; depth: number; dividers: SequenceFrame["dividers"]; minX: number; maxX: number }
  const frameStack: OpenFrame[] = [];
  const frames: SequenceFrame[] = [];
  const reach = (minX: number, maxX: number) => {
    for (const frame of frameStack) {
      frame.minX = Math.min(frame.minX, minX);
      frame.maxX = Math.max(frame.maxX, maxX);
    }
  };

  const lifelineTop = L.margin + L.headerHeight;
  let cursor = lifelineTop + L.firstGap;
  const rows: SequenceRow[] = [];
  for (const step of steps) {
    if (step.type === "block") {
      frameStack.push({ block: step, top: cursor + 6, depth: frameStack.length, dividers: [], minX: Infinity, maxX: -Infinity });
      rows.push({ step, top: cursor, height: ROW.block, y: cursor + 6 });
      cursor += ROW.block;
      continue;
    }
    if (step.type === "else") {
      const y = cursor + 8;
      frameStack.at(-1)?.dividers.push({ id: step.id, label: step.label, y });
      rows.push({ step, top: cursor, height: ROW.else, y });
      cursor += ROW.else;
      continue;
    }
    if (step.type === "end") {
      const frame = frameStack.pop();
      const y = cursor + 8;
      rows.push({ step, top: cursor, height: ROW.end, y });
      cursor += ROW.end;
      if (!frame) continue;
      // An empty frame sits under the first participant.
      const fallback = columns[0] ? [columns[0].x - 60, columns[0].x + 60] : [L.margin, L.margin + 120];
      const minX = Number.isFinite(frame.minX) ? frame.minX : fallback[0];
      const maxX = Number.isFinite(frame.maxX) ? frame.maxX : fallback[1];
      const left = minX - FRAME_PAD;
      const right = Math.max(maxX + FRAME_PAD, left + frameLabelWidth(frame.block));
      frames.push({ block: frame.block, left, right, top: frame.top, bottom: y, depth: frame.depth, dividers: frame.dividers });
      // The frame itself counts as content of the frames around it, so they wrap it with room to spare.
      reach(left, right);
      continue;
    }
    if (step.type === "note") {
      const lines = wrapText(step.text, L.noteWidth - L.notePadding * 2);
      const height = lines.length * L.noteLine + L.notePadding * 2 + 16;
      const xs = step.over.flatMap((id) => columnX.get(id) ?? []);
      if (xs.length) {
        const [left, right] = xs.length > 1 ? [Math.min(...xs) - 60, Math.max(...xs) + 60] : [xs[0] - L.noteWidth / 2, xs[0] + L.noteWidth / 2];
        reach(left, right);
      }
      rows.push({ step, top: cursor, height, y: cursor + 8, lines });
      cursor += height;
      continue;
    }
    const self = step.from === step.to;
    const height = self ? L.selfHeight : L.rowHeight;
    const y = cursor + (self ? 24 : height - 14);
    const fromX0 = columnX.get(step.from);
    const toX0 = columnX.get(step.to);
    let fromX: number | undefined;
    let toX: number | undefined;
    if (fromX0 !== undefined && toX0 !== undefined) {
      const direction: 1 | -1 = self || toX0 > fromX0 ? 1 : -1;
      fromX = barEdge(step.from, open.get(step.from)?.length ?? 0, direction);
      if (step.deactivate) closeBar(step.from, y);
      if (step.activate) {
        if (!open.has(step.to)) open.set(step.to, []);
        open.get(step.to)!.push(self ? y + 24 : y);
      }
      toX = barEdge(step.to, open.get(step.to)?.length ?? 0, self ? 1 : (-direction as 1 | -1));
      if (self) reach(fromX0, fromX0 + L.selfLoop + captionWidth(step));
      else reach(Math.min(fromX0, toX0), Math.max(fromX0, toX0));
    }
    rows.push({ step, top: cursor, height, y, fromX, toX });
    cursor += height;
  }

  const lifelineBottom = cursor + L.bottomGap;
  // Bars still open run to the end of the lifeline.
  for (const id of open.keys()) while (open.get(id)!.length) closeBar(id, lifelineBottom - 8);

  const last = columns.at(-1);
  // Calls to itself on the last participant loop out past its box.
  const lastSelf = steps.filter(
    (step): step is SequenceMessage => step.type === "message" && step.from === step.to && step.from === last?.participant.id,
  );
  const right = last
    ? Math.max(
        last.x + last.width / 2,
        last.x + L.noteWidth / 2,
        lastSelf.length ? last.x + L.selfLoop + Math.max(...lastSelf.map(captionWidth)) : 0,
        ...frames.map((frame) => frame.right),
      )
    : L.margin;
  return {
    columns,
    rows,
    // Outer frames first, so inner ones draw over them.
    frames: frames.sort((a, b) => a.depth - b.depth),
    activations,
    lifelineTop,
    lifelineBottom,
    width: Math.ceil(right + L.margin),
    height: Math.ceil(lifelineBottom + L.headerHeight + L.margin),
  };
}

/** The step a new message dropped at `y` goes before: after every row whose middle is above it. */
export function stepIndexAt(layout: SequenceLayout, y: number): number {
  return layout.rows.filter((row) => row.top + row.height / 2 < y).length;
}

/** The participant whose column is nearest `x`. */
export function columnAt(layout: SequenceLayout, x: number): SequenceColumn | undefined {
  let best: SequenceColumn | undefined;
  for (const column of layout.columns) {
    if (!best || Math.abs(column.x - x) < Math.abs(best.x - x)) best = column;
  }
  return best;
}

/** The component a participant stands for, if it's still there (a component on an architecture tab). */
export function linkedComponent(diagram: Pick<Diagram, "sections">, link: SequenceParticipant["component"]): DiagramNode | undefined {
  if (!link) return undefined;
  const section = diagram.sections.find((candidate) => candidate.id === link.sectionId && !candidate.sequence);
  return section?.nodes.find((node) => node.id === link.id && node.type === "block");
}

/**
 * Gives every linked participant its component's current name and colour, and unlinks those whose component has
 * gone (they keep the last name). Returns the same diagram when nothing changes.
 */
export function syncLinkedParticipants<T extends Pick<Diagram, "sections">>(diagram: T): T {
  let changed = false;
  const sections = diagram.sections.map((section) => {
    if (!section.sequence?.participants.some((participant) => participant.component)) return section;
    let touched = false;
    const participants = section.sequence.participants.map((participant) => {
      if (!participant.component) return participant;
      const component = linkedComponent(diagram, participant.component);
      if (!component) {
        touched = true;
        const unlinked = { ...participant };
        delete unlinked.component;
        return unlinked;
      }
      const { label, colorKey } = component.data;
      if (participant.label === label && participant.colorKey === colorKey) return participant;
      touched = true;
      const next = { ...participant, label };
      if (colorKey) next.colorKey = colorKey;
      else delete next.colorKey;
      return next;
    });
    if (!touched) return section;
    changed = true;
    return { ...section, sequence: { ...section.sequence, participants } };
  });
  return changed ? { ...diagram, sections } : diagram;
}

/** Components a participant can stand for: those on architecture tabs (not inside internal designs), by tab. */
export function linkableComponents(diagram: Pick<Diagram, "sections">): { section: DiagramSection; components: DiagramNode[] }[] {
  return diagram.sections
    .filter((section) => !section.sequence)
    .map((section) => ({ section, components: section.nodes.filter((node) => node.type === "block") }))
    .filter((group) => group.components.length);
}

/**
 * A component's key in pickers and sets: ids are only unique within a tab and can hold any character, so the
 * tab is part of it and it isn't joined with a separator.
 */
export function linkKey(link: NonNullable<SequenceParticipant["component"]>): string {
  return JSON.stringify([link.sectionId, link.id]);
}

/** The component (and its tab) a `linkKey` picks out of `linkableComponents`. */
export function findLinkable(
  groups: ReturnType<typeof linkableComponents>,
  key: string,
): { sectionId: string; component: DiagramNode } | undefined {
  for (const { section, components } of groups) {
    const component = components.find((node) => linkKey({ sectionId: section.id, id: node.id }) === key);
    if (component) return { sectionId: section.id, component };
  }
  return undefined;
}

/** A participant standing for a component, named and coloured after it. */
export function participantFor(sectionId: string, component: DiagramNode): SequenceParticipant {
  return {
    ...newParticipant(component.data.label, "participant", component.data.colorKey),
    component: { sectionId, id: component.id },
  };
}
