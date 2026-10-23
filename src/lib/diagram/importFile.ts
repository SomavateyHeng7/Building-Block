import { createBlankDiagram, createBlankSection } from "./factory";
import { parseDrawio } from "./importDrawio";
import { ImportError, parseMermaidSequence } from "./importMermaid";
import type { Diagram, DiagramSection, LegendEntry } from "./types";
import { parseDiagram } from "./validate";

export { ImportError };

/** What an import adds: tabs, the legend categories they use that weren't there, and notes for the user. */
export interface ImportResult {
  /** A name for a new diagram, from the file name or the diagram's own title. */
  name: string;
  sections: DiagramSection[];
  legend: LegendEntry[];
  fixes: string[];
}

/** Files the importer reads. */
export const IMPORT_EXTENSIONS = [".drawio", ".xml", ".mmd", ".mermaid", ".md", ".txt"];

export function isImportable(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return IMPORT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function baseName(fileName: string): string {
  return fileName.replace(/(\.drawio)?\.(drawio|xml|mmd|mermaid|md|txt)$/i, "").trim();
}

/**
 * Reads draw.io XML (architecture tabs) or Mermaid `sequenceDiagram` text (a sequence tab). `legend` is the
 * diagram's current one, so imported colours can reuse earlier imported categories. The result is passed
 * through the same checks as an opened file, so it is always a valid diagram. Throws ImportError with a
 * message for the user.
 */
export async function importDiagramText(text: string, fileName = "", legend: LegendEntry[] = []): Promise<ImportResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new ImportError("There's nothing to import.");

  let result: ImportResult;
  if (trimmed.startsWith("<")) {
    const drawio = await parseDrawio(trimmed, legend);
    result = { name: baseName(fileName) || "Imported diagram", ...drawio };
  } else {
    const mermaid = parseMermaidSequence(trimmed);
    const name = mermaid.title || baseName(fileName) || "Sequence";
    const section = { ...createBlankSection(name, "sequence"), sequence: mermaid.sequence };
    result = { name, sections: [section], legend: [], fixes: mermaid.fixes };
  }

  // The same checks as opening a file; anything they repair is reported too.
  const check: Diagram = { ...createBlankDiagram(result.name), legend: [...legend, ...result.legend], sections: result.sections };
  const { diagram, fixes } = parseDiagram(JSON.parse(JSON.stringify({ ...check, activeSectionId: result.sections[0].id })));
  return { ...result, sections: diagram.sections, fixes: [...result.fixes, ...fixes] };
}

/** A new diagram holding an import, with the default legend plus any categories the import made. */
export function diagramFromImport(result: ImportResult): Diagram {
  const diagram = createBlankDiagram(result.name);
  return { ...diagram, legend: [...diagram.legend, ...result.legend], sections: result.sections, activeSectionId: result.sections[0].id };
}
