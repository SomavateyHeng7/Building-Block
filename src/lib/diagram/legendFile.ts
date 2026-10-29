import { MAX_NAME_LENGTH } from "./limits";
import { parseHexColor } from "./palette";
import type { LegendEntry } from "./types";
import { DiagramFileError } from "./validate";

/**
 * A legend as a small file of its own, to reuse the same categories and colours across diagrams. Only names and
 * colours travel: the keys are particular to one diagram, so a legend read from a file is added by name
 * (see `addLegendEntries`), never replacing what a diagram has.
 */
const KIND = "building-block-legend";
const MAX_LEGEND_FILE_BYTES = 1024 * 1024;
const MAX_ENTRIES = 200;

export function legendToJson(legend: LegendEntry[]): string {
  return JSON.stringify({ kind: KIND, version: 1, legend: legend.map(({ label, color }) => ({ label, color })) }, null, 2);
}

export function legendFileName(diagramName: string, base: (name: string) => string): string {
  return `${base(diagramName)}-legend.json`;
}

/** The categories in a legend file, and how many entries were skipped as unusable. Throws DiagramFileError with a message for the user. */
export function parseLegendFile(source: string): { entries: { label: string; color: string }[]; skipped: number } {
  if (source.length > MAX_LEGEND_FILE_BYTES) throw new DiagramFileError("That legend file is too large.");
  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch {
    throw new DiagramFileError("That file isn't a valid JSON file.");
  }
  const input = json as { kind?: unknown; legend?: unknown } | null;
  // A whole diagram file works too: its legend is what's wanted.
  const list = input && typeof input === "object" && (input.kind === KIND || Array.isArray(input.legend)) ? input.legend : undefined;
  if (!Array.isArray(list)) throw new DiagramFileError("That file isn't a legend. Save one with Legend → Save to file.");

  const seen = new Set<string>();
  const entries: { label: string; color: string }[] = [];
  let skipped = 0;
  for (const item of list.slice(0, MAX_ENTRIES)) {
    const label = typeof item?.label === "string" ? item.label.trim().slice(0, MAX_NAME_LENGTH) : "";
    const color = typeof item?.color === "string" ? parseHexColor(item.color) : null;
    if (!label || !color || seen.has(label.toLowerCase())) {
      skipped += 1;
      continue;
    }
    seen.add(label.toLowerCase());
    entries.push({ label, color });
  }
  skipped += Math.max(0, list.length - MAX_ENTRIES);
  if (!entries.length) throw new DiagramFileError("That legend has no usable categories.");
  return { entries, skipped };
}
