import { componentIcon } from "./componentIcons";
import type { Diagram, DiagramEdge, DiagramNode, SequenceDiagram } from "./types";

/**
 * Finding things anywhere in a diagram: every tab, every component's internal design and every sequence. Matches
 * names first, then the other things an architect writes down (technology, owner, category, description, notes),
 * connections and messages by what flows and protocol, and notes on sequences by their text. A query of several
 * words finds what has every word somewhere ("orders kafka"), and accents don't matter ("cafe" finds "Café").
 */

export interface SearchResult {
  kind: "container" | "component" | "connection" | "participant" | "message" | "note";
  id: string;
  sectionId: string;
  /** Set when the result is inside this component's internal design. */
  detailId?: string;
  /** The name, "Orders → Billing" for a connection or message, or the start of a note. */
  label: string;
  /** Where it is: "Current", or "Current › Orders" inside an internal design. */
  where: string;
  /** What matched when it isn't the name, e.g. "Technology: Kafka". */
  match?: string;
}

/** Lower case, accents off, runs of spaces as one. */
export function normalize(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** The words of a query, for matching and for highlighting them in results. */
export function searchWords(query: string): string[] {
  const normal = normalize(query);
  return normal ? normal.split(" ") : [];
}

/**
 * Splits `text` into runs inside and outside the query's words, ignoring case and accents ("cafe" marks "Café").
 * Each character is folded on its own, so the marks line up with the original text.
 */
export function highlightWords(text: string, words: string[]): { text: string; mark: boolean }[] {
  const chars = [...text];
  if (!words.length || !chars.length) return [{ text, mark: false }];
  const folded = chars.map((char) => normalize(char) || " ");
  // Which character each position of the folded text came from (folding can change a character's length).
  const owner = folded.flatMap((char, index) => Array.from({ length: char.length }, () => index));
  const haystack = folded.join("");
  const marked = chars.map(() => false);
  for (const word of words) {
    for (let at = haystack.indexOf(word); at !== -1; at = haystack.indexOf(word, at + 1)) {
      for (let position = at; position < at + word.length; position++) marked[owner[position]] = true;
    }
  }
  const parts: { text: string; mark: boolean }[] = [];
  chars.forEach((char, index) => {
    const last = parts.at(-1);
    if (last && last.mark === marked[index]) last.text += char;
    else parts.push({ text: char, mark: marked[index] });
  });
  return parts;
}

interface Field {
  /** "Technology"; empty for a note's text, which needs no label. */
  name: string;
  value: string;
  normal: string;
}

/** One thing that can be found, with its text normalised once per diagram rather than once per keystroke. */
interface Entry {
  result: SearchResult;
  name: string;
  /** Components, containers and participants are found by their name; connections, messages and notes by what they say. */
  byName: boolean;
  fields: Field[];
}

const field = (name: string, value: string | undefined): Field[] => (value ? [{ name, value, normal: normalize(value) }] : []);

// Built when a diagram is first searched and reused while it's unchanged: every edit makes a new diagram object.
const indexes = new WeakMap<Diagram, Entry[]>();

function buildIndex(diagram: Diagram): Entry[] {
  const categories = new Map(diagram.legend.map((entry) => [entry.key, entry.label]));
  const entries: Entry[] = [];

  function visit(nodes: DiagramNode[], edges: DiagramEdge[], sectionId: string, where: string, detailId?: string) {
    for (const node of nodes) {
      const icon = node.data.kind === "block" ? componentIcon(node.data.icon)?.label : undefined;
      const result: SearchResult = { kind: node.type === "container" ? "container" : "component", id: node.id, sectionId, detailId, label: node.data.label, where };
      entries.push({
        result,
        name: normalize(node.data.label),
        byName: true,
        fields: [
          ...field("Technology", node.data.technology),
          ...field("Owner", node.data.owner),
          ...field("Category", node.data.colorKey ? categories.get(node.data.colorKey) : undefined),
          ...field("Icon", icon),
          ...field("Description", node.data.description),
          ...field("Notes", node.data.notes),
        ],
      });
    }
    const names = new Map(nodes.map((node) => [node.id, node.data.label]));
    for (const edge of edges) {
      const label = `${names.get(edge.source) ?? "?"} → ${names.get(edge.target) ?? "?"}`;
      entries.push({
        result: { kind: "connection", id: edge.id, sectionId, detailId, label, where },
        name: normalize(label),
        byName: false,
        fields: [...field("What flows", edge.label), ...field("Protocol", edge.protocol), ...field("Description", edge.description)],
      });
    }
  }

  function visitSequence(sequence: SequenceDiagram, sectionId: string, where: string) {
    const names = new Map(sequence.participants.map((participant) => [participant.id, participant.label]));
    const nameOf = (id: string) => names.get(id) ?? "?";
    for (const participant of sequence.participants) {
      entries.push({
        result: { kind: "participant", id: participant.id, sectionId, label: participant.label, where },
        name: normalize(participant.label),
        byName: true,
        fields: [
          ...field("Category", participant.colorKey ? categories.get(participant.colorKey) : undefined),
          ...field("Description", participant.description),
        ],
      });
    }
    for (const step of sequence.steps) {
      if (step.type === "note") {
        const label = step.text.length > 60 ? `${step.text.slice(0, 57)}…` : step.text;
        entries.push({
          result: { kind: "note", id: step.id, sectionId, label, where: `${where} › note over ${step.over.map(nameOf).join(", ")}` },
          name: "",
          byName: false,
          fields: field("", step.text),
        });
        continue;
      }
      const label = `${nameOf(step.from)} → ${nameOf(step.to)}`;
      entries.push({
        result: { kind: "message", id: step.id, sectionId, label, where },
        name: normalize(label),
        byName: false,
        fields: [...field("What's sent", step.label), ...field("Protocol", step.protocol)],
      });
    }
  }

  for (const section of diagram.sections) {
    if (section.sequence) {
      visitSequence(section.sequence, section.id, section.name);
      continue;
    }
    visit(section.nodes, section.edges ?? [], section.id, section.name);
    for (const node of section.nodes) {
      if (node.data.kind === "block" && node.data.detail) {
        const { nodes, edges } = node.data.detail;
        visit(nodes, edges ?? [], section.id, `${section.name} › ${node.data.label}`, node.id);
      }
    }
  }
  return entries;
}

/**
 * Lower is better: the name starting with the query, then containing it, then holding all its words; then every
 * word found across the name and the other fields. Connections, messages and notes need at least one word in what
 * they say: their ends' names alone find the components themselves.
 */
function score(entry: Entry, query: string, words: string[]): { score: number; match?: Field } | null {
  if (entry.byName) {
    if (entry.name.startsWith(query)) return { score: 0 };
    if (entry.name.includes(query)) return { score: 1 };
    if (words.length > 1 && words.every((word) => entry.name.includes(word))) return { score: 1.5 };
  }
  const inFields = (word: string) => entry.fields.some((candidate) => candidate.normal.includes(word));
  if (!words.every((word) => entry.name.includes(word) || inFields(word))) return null;
  // Show the field holding the whole query, else the first one holding a word the name doesn't.
  const match =
    entry.fields.find((candidate) => candidate.normal.includes(query)) ??
    entry.fields.find((candidate) => words.some((word) => !entry.name.includes(word) && candidate.normal.includes(word)));
  if (!match) return null;
  return { score: 2, match };
}

/** Indexes a diagram ahead of the first search, e.g. as the search opens, so the first keystroke is quick too. */
export function prepareSearch(diagram: Diagram): void {
  indexFor(diagram);
}

function indexFor(diagram: Diagram): Entry[] {
  let index = indexes.get(diagram);
  if (!index) indexes.set(diagram, (index = buildIndex(diagram)));
  return index;
}

export function searchDiagram(diagram: Diagram, rawQuery: string, limit = 50): SearchResult[] {
  const query = normalize(rawQuery);
  if (!query) return [];
  const words = query.split(" ");
  const index = indexFor(diagram);

  const results: { score: number; result: SearchResult }[] = [];
  for (const entry of index) {
    const found = score(entry, query, words);
    if (!found) continue;
    const result = { ...entry.result };
    if (found.match?.name) result.match = `${found.match.name}: ${found.match.value}`;
    results.push({ score: found.score, result });
  }

  // Stable: equal scores keep the diagram's order (tabs left to right, each tab before its internal designs).
  return results
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ result }) => result);
}
