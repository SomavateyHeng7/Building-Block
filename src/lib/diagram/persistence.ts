import { createBlankSection } from "./factory";
import type { Diagram } from "./types";

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

function writeIndex(index: DiagramSummary[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
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

export function getDiagramIndexServerSnapshot(): DiagramSummary[] {
  return [];
}

/** Guarantees at least one section and a valid activeSectionId. */
export function normalizeDiagram(diagram: Diagram): Diagram {
  const sections = diagram.sections?.length ? diagram.sections : [createBlankSection()];
  const activeSectionId = sections.some((section) => section.id === diagram.activeSectionId)
    ? diagram.activeSectionId
    : sections[0].id;
  return { ...diagram, sections, activeSectionId };
}

export function saveDiagram(diagram: Diagram): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(DIAGRAM_KEY_PREFIX + diagram.id, JSON.stringify(diagram));
  const index = readIndex().filter((entry) => entry.id !== diagram.id);
  index.unshift({ id: diagram.id, name: diagram.name, updatedAt: diagram.updatedAt });
  writeIndex(index);
  emitIndexChange();
}

export function loadDiagramFromStorage(id: string): Diagram | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(DIAGRAM_KEY_PREFIX + id);
    return raw ? normalizeDiagram(JSON.parse(raw) as Diagram) : null;
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

export async function readDiagramJsonFile(file: File): Promise<Diagram> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Diagram;
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.sections)) {
    throw new Error("Invalid diagram file");
  }
  return normalizeDiagram(parsed);
}
