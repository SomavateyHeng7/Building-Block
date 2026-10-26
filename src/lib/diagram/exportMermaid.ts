import { parseMermaidSequence, type MermaidImport } from "./importMermaid";
import { messageCaption } from "./sequence";
import type { SequenceDiagram, SequenceParticipant } from "./types";

/**
 * A sequence as Mermaid `sequenceDiagram` code, for the code view, copying and `.mmd` downloads. Reading it back
 * with `readSequenceCode` gives the same sequence: participants and actors in order, messages (call `->>`, async
 * `-)`, reply `-->>`, the protocol in brackets after the text), notes, and numbering as `autonumber`. Colours,
 * descriptions and links to components aren't Mermaid; `applySequenceCode` keeps them by matching names.
 */
export function toMermaidSequence(sequence: SequenceDiagram, title?: string): string {
  const ids = mermaidIds(sequence.participants);
  const lines = ["sequenceDiagram"];
  if (title?.trim()) lines.push(`  title ${escapeText(title.trim())}`);
  if (sequence.numbered !== false) lines.push("  autonumber");
  for (const participant of sequence.participants) {
    const id = ids.get(participant.id)!;
    const keyword = participant.shape === "actor" ? "actor" : "participant";
    lines.push(id === participant.label ? `  ${keyword} ${id}` : `  ${keyword} ${id} as ${escapeText(participant.label)}`);
  }
  for (const step of sequence.steps) {
    if (step.type === "note") {
      const over = step.over.map((id) => ids.get(id)).filter(Boolean).join(",");
      if (over) lines.push(`  Note over ${over}: ${escapeText(step.text).replace(/\n/g, "<br>")}`);
      continue;
    }
    const from = ids.get(step.from);
    const to = ids.get(step.to);
    if (!from || !to) continue;
    const arrow = step.kind === "async" ? "-)" : step.kind === "reply" ? "-->>" : "->>";
    const caption = escapeText(messageCaption(step));
    lines.push(`  ${from}${arrow}${to}:${caption ? ` ${caption}` : ""}`);
  }
  return `${lines.join("\n")}\n`;
}

/** Text that would end a Mermaid line or label early is written as `#code;`, which Mermaid and our reader decode. */
function escapeText(text: string): string {
  return text.replace(/[#;]/g, (char) => `#${char.codePointAt(0)};`);
}

/** Short ids Mermaid can use for each participant: its name if it's already one, else letters and digits from it. */
function mermaidIds(participants: SequenceParticipant[]): Map<string, string> {
  const ids = new Map<string, string>();
  const used = new Set<string>();
  participants.forEach((participant, index) => {
    const simple = /^[A-Za-z][A-Za-z0-9_]*$/.test(participant.label) ? participant.label : participant.label.replace(/[^A-Za-z0-9_]/g, "");
    const base = /^[A-Za-z]/.test(simple) ? simple : `P${index + 1}${simple}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}${n}`;
    used.add(id);
    ids.set(participant.id, id);
  });
  return ids;
}

/** Reads code from the code view: like an import, but brackets after a message are its protocol. */
export function readSequenceCode(code: string): MermaidImport {
  return parseMermaidSequence(code, { protocols: true });
}

/**
 * The sequence the code describes, keeping what Mermaid can't say from `current`: a participant with the same name
 * keeps its id, colour, description and link to a component. Numbering follows `autonumber`.
 */
export function applySequenceCode(current: SequenceDiagram, parsed: MermaidImport): SequenceDiagram {
  const unused = [...current.participants];
  const idMap = new Map<string, string>();
  const participants = parsed.sequence.participants.map((participant) => {
    const index = unused.findIndex((candidate) => candidate.label === participant.label);
    if (index === -1) return participant;
    const [kept] = unused.splice(index, 1);
    idMap.set(participant.id, kept.id);
    const merged: SequenceParticipant = { ...kept, label: participant.label };
    if (participant.shape === "actor") merged.shape = "actor";
    else delete merged.shape;
    return merged;
  });
  const id = (value: string) => idMap.get(value) ?? value;
  const steps = parsed.sequence.steps.map((step) =>
    step.type === "note" ? { ...step, over: step.over.map(id) } : { ...step, from: id(step.from), to: id(step.to) },
  );
  const next: SequenceDiagram = { ...current, participants, steps };
  if (parsed.autonumber) delete next.numbered;
  else next.numbered = false;
  return next;
}
