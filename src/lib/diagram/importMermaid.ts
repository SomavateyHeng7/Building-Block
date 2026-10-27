import { addParticipant, addStep, emptySequence, newMessage, newNote, newParticipant } from "./sequence";
import type { SequenceDiagram, SequenceMessageKind } from "./types";

/** Text that isn't something this importer can read; the message is shown to the user. */
export class ImportError extends Error {}

export interface MermaidImport {
  sequence: SequenceDiagram;
  /** From a `title` line, if there was one. */
  title?: string;
  /** Whether the text had an `autonumber` line (Mermaid numbers messages only then). */
  autonumber: boolean;
  /** What was left out or simplified, for the user. */
  fixes: string[];
}

/** The text inside a ```mermaid fence when there is one (e.g. a Markdown file), else the whole text. */
function mermaidSource(text: string): string {
  const fences = [...text.matchAll(/```mermaid[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]);
  return fences.find((block) => /^\s*sequenceDiagram\b/m.test(block)) ?? fences[0] ?? text;
}

/** Mermaid's `#59;`-style codes, for characters that would otherwise end a line or a label. */
function decodeEntities(text: string): string {
  return text.replace(/#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

/** Mermaid writes line breaks in labels as <br>; a name or a message is one line. */
function cleanLabel(text: string): string {
  return decodeEntities(text.replace(/<br\s*\/?>/gi, " ")).replace(/\s+/g, " ").trim();
}

/** A note keeps its line breaks. */
function cleanNote(text: string): string {
  return decodeEntities(text.replace(/<br\s*\/?>/gi, "\n"))
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim();
}

/** "Place order (REST)" → label and protocol, the way messages are written in the code view. */
function splitProtocol(text: string): { label?: string; protocol?: string } {
  const match = /^(.*?)\s*\(([^()]+)\)$/.exec(text);
  if (!match) return text ? { label: text } : {};
  return { ...(match[1] ? { label: match[1] } : {}), protocol: match[2].trim() };
}

// `A->>B: text`, with any of Mermaid's arrows, and optional +/- activation marks.
const MESSAGE = /^(.+?)\s*(<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\))\s*([+-]?)\s*([^:]+?)\s*:\s*(.*)$/;
const DECLARATION = /^(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/i;
const NOTE = /^note\s+(left of|right of|over)\s+([^:]+?)\s*:\s*(.*)$/i;
/** Blocks this importer flattens: their messages are kept, in order, without the box around them. */
const BLOCK_START = /^(loop|alt|else|opt|par|and|critical|option|break|rect)\b/i;
/** Lines that only affect how Mermaid draws, with nothing to keep. */
const IGNORED = /^(autonumber|activate|deactivate|box|end|create|destroy|links?|properties|details)\b/i;

function arrowKind(arrow: string): SequenceMessageKind {
  if (arrow.endsWith(")")) return "async";
  return arrow.startsWith("--") || arrow.startsWith("<<--") ? "reply" : "call";
}

/** Strips quotes Mermaid allows around names. */
function unquote(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 1 && trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
}

/**
 * Reads a Mermaid `sequenceDiagram`: participants and actors (with `as` aliases), messages with any arrow,
 * and notes. `loop`/`alt`/`opt`/`par` and similar blocks are flattened, keeping their messages in order;
 * styling lines are skipped. Throws ImportError when the text isn't a sequence diagram.
 *
 * With `protocols`, a message ending in brackets ("Place order (REST)") gives its protocol, as the code view
 * writes it; imports from elsewhere keep the brackets in the label. With `warnUndeclared` (the code view too), a
 * participant that's only mentioned, in code that declares its participants, is listed in `fixes`: it's usually a
 * typo. A name that matches a declared participant's display name ("Web Shop" for `WebShop as Web Shop`) is that
 * participant, not a new one.
 */
export function parseMermaidSequence(
  input: string,
  { protocols = false, warnUndeclared = false }: { protocols?: boolean; warnUndeclared?: boolean } = {},
): MermaidImport {
  const lines = mermaidSource(input)
    .split(/\r?\n/)
    .map((line) => line.replace(/%%.*$/, "").trim())
    .filter(Boolean);
  const header = lines.findIndex((line) => line !== "---" && !/^(title|config|theme)\b/i.test(line));
  const kind = lines[header]?.split(/\s/)[0];
  if (kind !== "sequenceDiagram") {
    throw new ImportError(
      kind && /^(flowchart|graph)$/.test(kind)
        ? "That's a Mermaid flowchart. Only Mermaid sequence diagrams work here; for architecture diagrams, import a draw.io file."
        : "That doesn't look like a Mermaid sequence diagram. It should start with \"sequenceDiagram\".",
    );
  }

  let sequence = emptySequence();
  const byName = new Map<string, string>();
  /** Declared participants by display name, so writing the name shown on the sheet finds them. */
  const byLabel = new Map<string, string>();
  let declaredAny = false;
  const undeclared: string[] = [];
  let title: string | undefined;
  let autonumber = false;
  let blocks = 0;
  let skipped = 0;

  /** The id of a participant by the name used in the text, adding it the first time it's mentioned. */
  function participant(name: string, shape?: "actor", label?: string, declaring = false): string {
    const key = unquote(name);
    const known = byName.get(key) ?? (declaring ? undefined : byLabel.get(key));
    if (known) return known;
    const added = newParticipant(cleanLabel(unquote(label ?? key)) || key, shape);
    sequence = addParticipant(sequence, added);
    byName.set(key, added.id);
    if (declaring) byLabel.set(added.label, added.id);
    else undeclared.push(added.label);
    return added.id;
  }

  for (const line of lines.slice(header + 1)) {
    const titled = /^title\s*:?\s*(.+)$/i.exec(line);
    if (titled) {
      title = cleanLabel(titled[1]);
      continue;
    }
    const declared = DECLARATION.exec(line);
    if (declared) {
      declaredAny = true;
      participant(declared[2], declared[1].toLowerCase() === "actor" ? "actor" : undefined, declared[3], true);
      continue;
    }
    const note = NOTE.exec(line);
    if (note) {
      // Participants are added first: addStep must see them.
      const over = note[2].split(",").map((name) => participant(name)).slice(0, 2);
      const step = newNote(over, cleanNote(note[3]));
      sequence = addStep(sequence, step);
      continue;
    }
    const message = MESSAGE.exec(line);
    if (message) {
      const [, from, arrow, , to, label] = message;
      const text = cleanLabel(label);
      // Participants are added first: addStep must see them.
      const step = newMessage(participant(from), participant(to), {
        ...(protocols ? splitProtocol(text) : text ? { label: text } : {}),
        ...(arrowKind(arrow) !== "call" ? { kind: arrowKind(arrow) } : {}),
      });
      sequence = addStep(sequence, step);
      continue;
    }
    if (BLOCK_START.test(line)) {
      if (!/^(else|and|option)\b/i.test(line)) blocks += 1;
      continue;
    }
    if (/^autonumber\b/i.test(line)) {
      autonumber = true;
      continue;
    }
    if (IGNORED.test(line)) continue;
    skipped += 1;
  }

  if (!sequence.participants.length) throw new ImportError("That sequence diagram has no participants or messages to import.");
  const fixes: string[] = [];
  if (blocks) {
    fixes.push(`Flattened ${blocks} loop/alt/opt/par block${blocks === 1 ? "" : "s"}: their messages are kept in order, without the box around them.`);
  }
  if (skipped) fixes.push(`Skipped ${skipped} line${skipped === 1 ? "" : "s"} that couldn't be read.`);
  if (warnUndeclared && declaredAny && undeclared.length) {
    const names = undeclared.map((name) => `"${name}"`).join(", ");
    fixes.push(
      `Added ${undeclared.length === 1 ? "a participant that isn't" : `${undeclared.length} participants that aren't`} declared: ${names}. If that's a typo, fix the name and apply again.`,
    );
  }
  return { sequence, title, autonumber, fixes };
}
