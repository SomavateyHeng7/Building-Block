import { fileBaseName } from "./file";
import { componentsWithDetail } from "./store";
import type { Diagram } from "./types";

/** Pictures of views, and lists or files that cover the whole diagram. */
export type ExportFormat = "png" | "svg" | "pdf" | "components-csv" | "connections-csv" | "json";
export const IMAGE_FORMATS: ExportFormat[] = ["png", "svg", "pdf"];
export const DATA_FORMATS: ExportFormat[] = ["components-csv", "connections-csv", "json"];

/** One file, or one download per file. */
export type Bundle = "one" | "separate";

/** Something that can be pictured: a tab, or a component's internal design. */
export interface ExportView {
  /** Unique: the tab id, or "tab/component". */
  id: string;
  sectionId: string;
  componentId?: string;
  /** "Current", or "Orders" for an internal design. */
  label: string;
  /** The tab an internal design belongs to. */
  tabLabel?: string;
  nodeCount: number;
  /** File name without extension. */
  stem: string;
}

export interface PlannedFile {
  name: string;
  format: ExportFormat;
  /** The views pictured in it; empty for lists and the diagram file. */
  views: ExportView[];
}

export interface ExportPlan {
  files: PlannedFile[];
  /** Set when the files are bundled into one .zip. */
  zipName?: string;
}

/** Every view, in order: each tab, followed by its components' internal designs. */
export function exportViews(diagram: Diagram): ExportView[] {
  const base = fileBaseName(diagram.name);
  const severalTabs = diagram.sections.length > 1;
  return diagram.sections.flatMap((section) => {
    const tabStem = severalTabs ? `${base}-${fileBaseName(section.name)}` : base;
    return [
      {
        id: section.id,
        sectionId: section.id,
        label: section.name,
        // A sequence tab has something to picture once it has a participant.
        nodeCount: section.sequence ? section.sequence.participants.length : section.nodes.length,
        stem: tabStem,
      },
      ...componentsWithDetail(section).map((component) => ({
        id: `${section.id}/${component.id}`,
        sectionId: section.id,
        componentId: component.id,
        label: component.data.label,
        tabLabel: section.name,
        nodeCount: component.data.kind === "block" ? (component.data.detail?.nodes.length ?? 0) : 0,
        stem: `${tabStem}-${fileBaseName(component.data.label)}-internal`,
      })),
    ];
  });
}

const EXTENSION: Record<ExportFormat, string> = {
  png: "png",
  svg: "svg",
  pdf: "pdf",
  "components-csv": "csv",
  "connections-csv": "csv",
  json: "json",
};

/**
 * The files an export produces. Images get one file per view, except a PDF bundled as one file, which has
 * a page per view. Lists and the diagram file cover the whole diagram. More than one file bundled as one
 * becomes a .zip.
 */
export function planExport(
  diagram: Diagram,
  { views, formats, bundle }: { views: ExportView[]; formats: ExportFormat[]; bundle: Bundle },
): ExportPlan {
  const base = fileBaseName(diagram.name);
  const pictured = views.filter((view) => view.nodeCount > 0);
  const files: PlannedFile[] = [];
  for (const format of formats) {
    if (format === "pdf" && (bundle === "one" || pictured.length === 1)) {
      if (pictured.length) files.push({ name: `${pictured.length === 1 ? pictured[0].stem : base}.pdf`, format, views: pictured });
    } else if (IMAGE_FORMATS.includes(format)) {
      for (const view of pictured) files.push({ name: `${view.stem}.${EXTENSION[format]}`, format, views: [view] });
    } else {
      const suffix = format === "components-csv" ? "-components" : format === "connections-csv" ? "-connections" : "";
      files.push({ name: `${base}${suffix}.${EXTENSION[format]}`, format, views: [] });
    }
  }
  // Two views can share a name (e.g. tabs with the same title); number the repeats.
  const seen = new Map<string, number>();
  for (const file of files) {
    const count = (seen.get(file.name) ?? 0) + 1;
    seen.set(file.name, count);
    if (count > 1) file.name = file.name.replace(/(\.[a-z]+)$/, `-${count}$1`);
  }
  return { files, ...(bundle === "one" && files.length > 1 ? { zipName: `${base}.zip` } : {}) };
}

/** "3 PNG images, 1 PDF and the component list", for the dialog and the toast. */
export function describeFiles(files: PlannedFile[]): string {
  const count = (format: ExportFormat) => files.filter((file) => file.format === format).length;
  const parts: string[] = [];
  const images: [ExportFormat, string][] = [
    ["png", "PNG image"],
    ["svg", "SVG image"],
    ["pdf", "PDF"],
  ];
  for (const [format, word] of images) {
    const n = count(format);
    if (n) parts.push(`${n} ${word}${n === 1 ? "" : "s"}`);
  }
  if (count("components-csv")) parts.push("the component list");
  if (count("connections-csv")) parts.push("the connection list");
  if (count("json")) parts.push("the diagram file");
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "nothing");
}
