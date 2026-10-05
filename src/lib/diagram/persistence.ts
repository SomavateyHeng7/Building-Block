import { createId } from "./factory";
import type { Diagram } from "./types";
import { DiagramFileError, parseDiagram, type ParsedDiagram } from "./validate";

const DIAGRAM_KEY_PREFIX = "bb:diagram:";
const INDEX_KEY = "bb:index";

export interface DiagramSummary {
  id: string;
  name: string;
  updatedAt: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readIndex(): DiagramSummary[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as DiagramSummary[]) : [];
  } catch {
    return [];
  }
}

/** Storage can be full, blocked or disabled (private mode); callers decide how to tell the user. */
function writeItem(key: string, value: string): boolean {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function writeIndex(index: DiagramSummary[]): boolean {
  return writeItem(INDEX_KEY, JSON.stringify(index));
}

function sortByRecency(index: DiagramSummary[]): DiagramSummary[] {
  return [...index].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

type IndexListener = () => void;
const indexListeners = new Set<IndexListener>();
let cachedSummaries: DiagramSummary[] = sortByRecency(readIndex());

function emitIndexChange() {
  cachedSummaries = sortByRecency(readIndex());
  indexListeners.forEach((listener) => listener());
}

export function subscribeDiagramIndex(listener: IndexListener): () => void {
  indexListeners.add(listener);
  return () => indexListeners.delete(listener);
}

export function getDiagramIndexSnapshot(): DiagramSummary[] {
  return cachedSummaries;
}

// Must be the same array on every call, or useSyncExternalStore loops during hydration.
const EMPTY_INDEX: DiagramSummary[] = [];

export function getDiagramIndexServerSnapshot(): DiagramSummary[] {
  return EMPTY_INDEX;
}

/** Returns false when the browser refused to store it, so the diagram exists only in memory. */
export function saveDiagram(diagram: Diagram): boolean {
  if (!writeItem(DIAGRAM_KEY_PREFIX + diagram.id, JSON.stringify(diagram))) return false;
  const index = readIndex().filter((entry) => entry.id !== diagram.id);
  index.unshift({ id: diagram.id, name: diagram.name, updatedAt: diagram.updatedAt });
  const indexed = writeIndex(index);
  emitIndexChange();
  return indexed;
}

export function loadDiagramFromStorage(id: string): Diagram | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(DIAGRAM_KEY_PREFIX + id);
    return raw ? parseDiagram(JSON.parse(raw)).diagram : null;
  } catch {
    return null;
  }
}

export function listDiagrams(): DiagramSummary[] {
  return sortByRecency(readIndex());
}

export function deleteDiagram(id: string): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(DIAGRAM_KEY_PREFIX + id);
  writeIndex(readIndex().filter((entry) => entry.id !== id));
  emitIndexChange();
}

/** File-name-safe version of a diagram name, e.g. "L0 Architecture" → "l0-architecture". */
export function fileBaseName(name: string): string {
  return name.trim().replace(/\s+/g, "-").toLowerCase() || "diagram";
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (!isBrowser()) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadDiagramJson(diagram: Diagram): void {
  const blob = new Blob([JSON.stringify(diagram, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${fileBaseName(diagram.name)}.json`);
}

/**
 * Reads a diagram backup, repairs what it can, and saves it as a new diagram
 * (a new id, so importing never overwrites an existing diagram).
 */
export async function importDiagramFile(file: File): Promise<ParsedDiagram> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new DiagramFileError("That file isn't a valid JSON file.");
  }
  const { diagram, fixes } = parseDiagram(json);
  const imported: Diagram = { ...diagram, id: createId("diagram"), updatedAt: new Date().toISOString() };
  if (!saveDiagram(imported)) {
    throw new DiagramFileError("Your browser wouldn't store it (storage may be full or blocked).");
  }
  return { diagram: imported, fixes };
}
