import { MAX_MERMAID_LINE } from "./limits";
import { addParticipant, addStep, balanceSteps, splitCaption, emptySequence, newBlock, newElse, newEnd, newMessage, newNote, newParticipant } from "./sequence";
import type { SequenceBlockKind, SequenceDiagram, SequenceMessage, SequenceMessageKind } from "./types";
import { MAX_CODE_POINT } from "./xml";

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

/** Mermaid's `#59;`-style codes, for characters that would otherwise end a line or a label. A code past Unicode is kept as written. */
function decodeEntities(text: string): string {
  return text.replace(/#(\d+);/g, (match, code: string) => (Number(code) <= MAX_CODE_POINT ? String.fromCodePoint(Number(code)) : match));
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

// `A->>B: text`, with any of Mermaid's arrows, and optional +/- activation marks.
const MESSAGE = /^(.+?)\s*(<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\))\s*([+-]?)\s*([^:]+?)\s*:\s*(.*)$/;
const DECLARATION = /^(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/i;
const NOTE = /^note\s+(left of|right of|over)\s+([^:]+?)\s*:\s*(.*)$/i;
/** Frames kept as frames: `loop Every minute` … `end`. */
const BLOCK_START = /^(loop|alt|opt|par|critical|break)\b\s*(.*)$/i;
/** The next part of the open frame. */
const BLOCK_DIVIDER = /^(else|and|option)\b\s*(.*)$/i;
/** Boxes that only colour things (`rect`, `box`): what's inside is kept, without the box. */
const DECORATION = /^(rect|box)\b/i;
const ACTIVATION = /^(activate|deactivate)\s+(.+)$/i;
/** Lines that only affect how Mermaid draws, with nothing to keep. */
const IGNORED = /^(autonumber|create|destroy|links?|properties|details)\b/i;

/** A piece of a code line and what it is, for highlighting. */
export interface CodeToken {
  text: string;
  kind: "keyword" | "name" | "arrow" | "text" | "protocol" | "comment" | "plain" | "unknown";
}

/**
 * Splits one line of sequence code into tokens, with the same patterns the reader uses, so what's highlighted
 * as unreadable is exactly what the reader skips. Joining the tokens' text gives the line back.
 */
export function tokenizeMermaidLine(line: string): CodeToken[] {
  const comment = line.indexOf("%%");
  const code = comment === -1 ? line : line.slice(0, comment);
  const tail: CodeToken[] = comment === -1 ? [] : [{ text: line.slice(comment), kind: "comment" }];
  const lead = /^\s*/.exec(code)![0];
  const body = code.slice(lead.length);
  const trailing = /\s*$/.exec(body)![0];
  const content = body.slice(0, body.length - trailing.length);
  const wrap = (tokens: CodeToken[]): CodeToken[] => [
    ...(lead ? [{ text: lead, kind: "plain" as const }] : []),
    ...tokens,
    ...(trailing ? [{ text: trailing, kind: "plain" as const }] : []),
    ...tail,
  ];
  if (!content) return wrap([]);

  const message = /^(.+?)(\s*)(<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\))(\s*[+-]?\s*)([^:]+?)(\s*:\s*)(.*)$/.exec(content);
  if (message) {
    const [, from, gap, arrow, mark, to, colon, text] = message;
    const protocol = /^(.*?)(\s*\([^()]+\))$/.exec(text);
    return wrap([
      { text: from, kind: "name" },
      ...(gap ? [{ text: gap, kind: "plain" as const }] : []),
      { text: arrow + mark, kind: "arrow" },
      { text: to, kind: "name" },
      { text: colon, kind: "plain" },
      ...(protocol ? [{ text: protocol[1], kind: "text" as const }, { text: protocol[2], kind: "protocol" as const }] : [{ text, kind: "text" as const }]),
    ]);
  }
  const declared = /^(participant|actor)(\s+)(.+?)(?:(\s+as\s+)(.+))?$/i.exec(content);
  if (declared) {
    return wrap([
      { text: declared[1], kind: "keyword" },
      { text: declared[2], kind: "plain" },
      { text: declared[3], kind: "name" },
      ...(declared[4] ? [{ text: declared[4], kind: "keyword" as const }, { text: declared[5], kind: "text" as const }] : []),
    ]);
  }
  const note = /^(note\s+(?:left of|right of|over))(\s+)([^:]+?)(\s*:\s*)(.*)$/i.exec(content);
  if (note) {
    return wrap([
      { text: note[1], kind: "keyword" },
      { text: note[2], kind: "plain" },
      { text: note[3], kind: "name" },
      { text: note[4], kind: "plain" },
      { text: note[5], kind: "text" },
    ]);
  }
  const keyword = /^(sequenceDiagram|autonumber|title|loop|alt|else|opt|par|and|critical|option|break|end|rect|box|activate|deactivate|create|destroy|links?|properties|details)\b(.*)$/i.exec(content);
  if (keyword) {
    const rest = keyword[2];
    const isName = /^(activate|deactivate)$/i.test(keyword[1]);
    return wrap([{ text: keyword[1], kind: "keyword" }, ...(rest ? [{ text: rest, kind: isName ? ("name" as const) : ("text" as const) }] : [])]);
  }
  if (content === "---" || /^(config|theme)\b/i.test(content)) return wrap([{ text: content, kind: "comment" }]);
  return wrap([{ text: content, kind: "unknown" }]);
}

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
 * Reads a Mermaid `sequenceDiagram`: participants and actors (with `as` aliases), messages with any arrow and
 * their activation marks (`+`/`-`, or `activate`/`deactivate` lines), notes, and `loop`/`alt`/`opt`/`par`/
 * `critical`/`break` frames with their `else`/`and`/`option` parts. Colour boxes and styling lines are skipped. Throws ImportError when the text isn't a sequence diagram.
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
  if (lines.some((line) => line.length > MAX_MERMAID_LINE)) {
    throw new ImportError(`A line is longer than ${MAX_MERMAID_LINE} characters, which is more than a sequence diagram needs.`);
  }
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
  let decorations = 0;
  let skipped = 0;
  /** What each open `… end` is: a frame kept on the sheet, or a box that's dropped. */
  const opened: ("frame" | "decoration")[] = [];
  const lastMessage = () => sequence.steps.findLast((step): step is SequenceMessage => step.type === "message");

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
      const [, from, arrow, mark, to, label] = message;
      const text = cleanLabel(label);
      // Participants are added first: addStep must see them.
      const step = newMessage(participant(from), participant(to), {
        ...(protocols ? splitCaption(text) : text ? { label: text } : {}),
        ...(arrowKind(arrow) !== "call" ? { kind: arrowKind(arrow) } : {}),
        ...(mark === "+" ? { activate: true } : mark === "-" ? { deactivate: true } : {}),
      });
      sequence = addStep(sequence, step);
      continue;
    }
    const block = BLOCK_START.exec(line);
    if (block) {
      opened.push("frame");
      sequence = addStep(sequence, newBlock(block[1].toLowerCase() as SequenceBlockKind, cleanLabel(block[2]) || undefined));
      continue;
    }
    const divider = BLOCK_DIVIDER.exec(line);
    if (divider) {
      if (opened.at(-1) === "frame") sequence = addStep(sequence, newElse(cleanLabel(divider[2]) || undefined));
      else skipped += 1;
      continue;
    }
    if (DECORATION.test(line)) {
      opened.push("decoration");
      decorations += 1;
      continue;
    }
    if (/^end$/i.test(line)) {
      if (opened.pop() === "frame") sequence = addStep(sequence, newEnd());
      continue;
    }
    // `activate X` / `deactivate X` lines become the marks on the message just before, where they fit.
    const activation = ACTIVATION.exec(line);
    if (activation) {
      const id = byName.get(unquote(activation[2])) ?? byLabel.get(unquote(activation[2]));
      const previous = lastMessage();
      const on = activation[1].toLowerCase() === "activate";
      if (id && previous && (on ? previous.to === id : previous.from === id)) {
        sequence = {
          ...sequence,
          steps: sequence.steps.map((step) => (step === previous ? { ...previous, [on ? "activate" : "deactivate"]: true } : step)),
        };
      } else skipped += 1;
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
  const balanced = balanceSteps(sequence.steps);
  if (balanced !== sequence.steps) {
    fixes.push("Closed a loop/alt/opt block that had no \"end\".");
    sequence = { ...sequence, steps: balanced };
  }
  if (decorations) {
    fixes.push(`Left out ${decorations} coloured box${decorations === 1 ? "" : "es"} (rect/box): what was inside is kept.`);
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
