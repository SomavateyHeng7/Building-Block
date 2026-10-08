import { create } from "zustand";
import { toast } from "@/lib/toast";
import { useDiagramStore } from "./store";
import type { Diagram } from "./types";
import { DiagramFileError, parseDiagram } from "./validate";

/**
 * Diagrams are never kept by the app. A diagram lives in memory while it is open, and the user's own
 * .json file is the only copy: Open reads one, Save writes it back (draw.io's "Device" storage).
 * Browsers with the File System Access API save in place; the rest download a file on every save.
 */

interface FileState {
  /** A diagram has been opened or started this session; a reload starts over at the start page. */
  opened: boolean;
  /** The file Save writes to. Only available with the File System Access API. */
  handle: FileSystemFileHandle | null;
  fileName: string | null;
  /** The exact diagram object last written to a file (the store makes a new one per edit); null when never saved. */
  saved: Diagram | null;
  saving: boolean;
  /** The last write failed. */
  error: boolean;
}

export const useFileStore = create<FileState>(() => ({
  opened: false,
  handle: null,
  fileName: null,
  saved: null,
  saving: false,
  error: false,
}));

const PICKER_TYPES: FilePickerAcceptType[] = [
  { description: "Building Block diagram", accept: { "application/json": [".json"] } },
];

export function supportsFilePicker(): boolean {
  return typeof window !== "undefined" && !!window.showOpenFilePicker && !!window.showSaveFilePicker;
}

export function hasContent(diagram: Diagram): boolean {
  return diagram.sections.some((section) => section.nodes.length > 0);
}

/** File-name-safe version of a diagram name, e.g. "L0 Architecture" → "l0-architecture". */
export function fileBaseName(name: string): string {
  return name.trim().replace(/\s+/g, "-").toLowerCase() || "diagram";
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadDiagramJson(diagram: Diagram): void {
  downloadBlob(new Blob([JSON.stringify(diagram, null, 2)], { type: "application/json" }), `${fileBaseName(diagram.name)}.json`);
}

function isDirtyNow(): boolean {
  const { opened, saved } = useFileStore.getState();
  const { diagram } = useDiagramStore.getState();
  return opened && saved !== diagram && (saved !== null || hasContent(diagram));
}

/** Changes that exist only in memory. An empty, never-saved diagram has nothing to lose. */
export function isDirty(): boolean {
  return isDirtyNow();
}

export function useIsDirty(): boolean {
  const opened = useFileStore((state) => state.opened);
  const saved = useFileStore((state) => state.saved);
  const diagram = useDiagramStore((state) => state.diagram);
  return opened && saved !== diagram && (saved !== null || hasContent(diagram));
}

/** Makes `diagram` the open one. `file` is where it came from; omit it for a new, unsaved diagram. */
export function startDiagram(diagram: Diagram, file?: { handle: FileSystemFileHandle | null; fileName: string }): void {
  useDiagramStore.getState().loadDiagram(diagram);
  useFileStore.setState({
    opened: true,
    handle: file?.handle ?? null,
    fileName: file?.fileName ?? null,
    saved: file ? diagram : null,
    saving: false,
    error: false,
  });
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Writes the open diagram to its file, asking where on first save (or for Save As).
 * Without the File System Access API it downloads a copy instead. Resolves false if the user cancelled or it failed.
 */
export async function saveDiagramToFile({ saveAs = false }: { saveAs?: boolean } = {}): Promise<boolean> {
  if (useFileStore.getState().saving) return false;
  const diagram = useDiagramStore.getState().diagram;
  const json = JSON.stringify(diagram, null, 2);
  const baseName = `${fileBaseName(diagram.name)}.json`;

  useFileStore.setState({ saving: true });
  try {
    if (supportsFilePicker()) {
      let handle = saveAs ? null : useFileStore.getState().handle;
      if (!handle) handle = await window.showSaveFilePicker!({ suggestedName: baseName, types: PICKER_TYPES });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      useFileStore.setState({ handle, fileName: handle.name, saved: diagram, error: false });
    } else {
      downloadBlob(new Blob([json], { type: "application/json" }), baseName);
      useFileStore.setState({ fileName: baseName, saved: diagram, error: false });
    }
    return true;
  } catch (error) {
    if (isAbort(error)) return false;
    console.error(error);
    if (!useFileStore.getState().error) {
      toast.error("Couldn't save the file", {
        details: ["The file may be read-only, moved, or its folder no longer allows writing.", "Use Save as to pick another location."],
        duration: 0,
      });
    }
    useFileStore.setState({ error: true });
    return false;
  } finally {
    useFileStore.setState({ saving: false });
  }
}

export async function parseDiagramFile(file: File): Promise<{ diagram: Diagram; fixes: string[] }> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new DiagramFileError("That file isn't a valid JSON file.");
  }
  return parseDiagram(json);
}

/** A plain file input, for browsers that can pick a file but can't write back to it. */
function pickFileWithInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    // Some systems report no MIME type for .json files, so match the extension too.
    input.accept = ".json,application/json";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/**
 * Asks for a diagram file and opens it. Resolves null if the user cancelled or the file couldn't be read
 * (the user has already been told why). Call it straight from a click so the browser allows the picker.
 */
export async function openDiagramFromDevice(): Promise<Diagram | null> {
  let file: File | null;
  let handle: FileSystemFileHandle | null = null;
  try {
    if (supportsFilePicker()) {
      [handle] = await window.showOpenFilePicker!({ types: PICKER_TYPES, multiple: false });
      file = await handle.getFile();
    } else {
      file = await pickFileWithInput();
    }
  } catch (error) {
    if (!isAbort(error)) {
      console.error(error);
      toast.error("Couldn't open the file");
    }
    return null;
  }
  if (!file) return null;
  return openDiagramFile(file, handle);
}

/**
 * Opens a diagram dropped onto the page. Call it synchronously from the drop event: the browser
 * only hands over the file handle (so Save writes back in place) during the event itself.
 */
export async function openDroppedDiagram(dataTransfer: DataTransfer): Promise<Diagram | null> {
  const item = [...dataTransfer.items].find((candidate) => candidate.kind === "file");
  if (!item) return null;
  const file = item.getAsFile();
  const handlePromise = supportsFilePicker() && item.getAsFileSystemHandle ? item.getAsFileSystemHandle() : null;
  if (!file) return null;
  let handle: FileSystemFileHandle | null = null;
  try {
    const dropped = await handlePromise;
    if (dropped?.kind === "file") handle = dropped as FileSystemFileHandle;
  } catch {
    // No handle: the diagram still opens, and Save asks where to write.
  }
  return openDiagramFile(file, handle);
}

async function openDiagramFile(file: File, handle: FileSystemFileHandle | null): Promise<Diagram | null> {
  try {
    const { diagram, fixes } = await parseDiagramFile(file);
    startDiagram(diagram, { handle, fileName: file.name });
    if (fixes.length) toast.info(`Opened "${diagram.name}" with some repairs`, { details: [...fixes, "Save to keep the repaired version."] });
    return diagram;
  } catch (error) {
    toast.error(`Couldn't open "${file.name}"`, {
      details: [error instanceof DiagramFileError ? error.message : "Please check it's a diagram saved from Building Block."],
    });
    return null;
  }
}
