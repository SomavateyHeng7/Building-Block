import { createId } from "./factory";
import type {
  Diagram,
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

export function moveStep(sequence: SequenceDiagram, id: string, index: number): SequenceDiagram {
  const steps = moveItem(sequence.steps, id, index);
  return steps === sequence.steps ? sequence : { ...sequence, steps };
}

export function removeStep(sequence: SequenceDiagram, id: string): SequenceDiagram {
  return { ...sequence, steps: sequence.steps.filter((step) => step.id !== id) };
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
  /** Where a message's arrow runs, or a note's top. */
  y: number;
  /** A note's lines, already wrapped. */
  lines?: string[];
}

export interface SequenceLayout {
  columns: SequenceColumn[];
  rows: SequenceRow[];
  /** Below the boxes, where the lifelines start; and where they end. */
  lifelineTop: number;
  lifelineBottom: number;
  width: number;
  height: number;
}

export function layoutSequence(sequence: SequenceDiagram): SequenceLayout {
  const L = SEQUENCE_LAYOUT;
  const { participants, steps } = sequence;
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
  let x = L.margin + (widths[0] ?? 0) / 2;
  participants.forEach((participant, position) => {
    columns.push({ participant, x, width: widths[position] });
    x += gaps[position] ?? 0;
  });

  const lifelineTop = L.margin + L.headerHeight;
  let cursor = lifelineTop + L.firstGap;
  const rows: SequenceRow[] = steps.map((step) => {
    if (step.type === "note") {
      const lines = wrapText(step.text, L.noteWidth - L.notePadding * 2);
      const height = lines.length * L.noteLine + L.notePadding * 2 + 16;
      const row = { step, top: cursor, height, y: cursor + 8, lines };
      cursor += height;
      return row;
    }
    const height = step.from === step.to ? L.selfHeight : L.rowHeight;
    const row = { step, top: cursor, height, y: cursor + (step.from === step.to ? 24 : height - 14) };
    cursor += height;
    return row;
  });

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
      )
    : L.margin;
  const lifelineBottom = cursor + L.bottomGap;
  return {
    columns,
    rows,
    lifelineTop,
    lifelineBottom,
    width: Math.ceil(right + L.margin),
    height: Math.ceil(lifelineBottom + L.margin),
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
