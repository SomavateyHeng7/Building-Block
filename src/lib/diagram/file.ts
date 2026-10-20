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

/**
 * File-name-safe version of a diagram name, e.g. "L0 Architecture" → "l0-architecture". Drops characters
 * Windows or macOS don't allow and avoids Windows' reserved names (CON, NUL, COM1…).
 */
export function fileBaseName(name: string): string {
  const base = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .trim()
    .replace(/[\s\u2013\u2014]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase()
    .slice(0, 100);
  if (!base) return "diagram";
  return /^(con|prn|aux|nul|com\d|lpt\d)$/.test(base) ? `${base}-diagram` : base;
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Safari can still be starting the download after click() returns, so keep the URL alive a while.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadDiagramJson(diagram: Diagram): void {
  downloadBlob(new Blob([JSON.stringify(diagram, null, 2)], { type: "application/json" }), `${fileBaseName(diagram.name)}.json`);
}

/**
 * Which tab or internal design is showing isn't an edit, so a diagram that differs from the saved one only
 * by that is clean.
 */
function differsFromSaved(saved: Diagram | null, diagram: Diagram): boolean {
  if (saved === diagram) return false;
  if (!saved) return hasContent(diagram);
  const keys = new Set([...Object.keys(saved), ...Object.keys(diagram)] as (keyof Diagram)[]);
  keys.delete("activeSectionId");
  keys.delete("activeDetailId");
  return [...keys].some((key) => saved[key] !== diagram[key]);
}

function isDirtyNow(): boolean {
  const { opened, saved } = useFileStore.getState();
  return opened && differsFromSaved(saved, useDiagramStore.getState().diagram);
}

/** Changes that exist only in memory. An empty, never-saved diagram has nothing to lose. */
export function isDirty(): boolean {
  return isDirtyNow();
}

export function useIsDirty(): boolean {
  const opened = useFileStore((state) => state.opened);
  const saved = useFileStore((state) => state.saved);
  const diagram = useDiagramStore((state) => state.diagram);
  return opened && differsFromSaved(saved, diagram);
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
        description: "It may be read-only or have moved. Use File → Save as to choose another location.",
        action: { label: "Save as…", onClick: () => void saveDiagramToFile({ saveAs: true }) },
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
      toast.error("Couldn't open the file", { description: "Please try again, or drop the file onto the start page." });
    }
    return null;
  }
  if (!file) return null;
  return openDiagramFile(file, handle);
}

export interface DroppedFile {
  file: File;
  handle: FileSystemFileHandle | null;
}

/**
 * Takes the file dropped onto the page. Call it synchronously from the drop event: the browser
 * only hands over the file handle (so Save writes back in place) during the event itself.
 */
export async function takeDroppedFile(dataTransfer: DataTransfer): Promise<DroppedFile | null> {
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
  return { file, handle };
}

/** Opens a file taken with takeDroppedFile. Resolves null if it couldn't be read (the user has been told why). */
export async function openDroppedDiagram(dropped: DroppedFile | null): Promise<Diagram | null> {
  return dropped ? openDiagramFile(dropped.file, dropped.handle) : null;
}

/**
 * Opens the file the installed app was launched with (double-clicking a .json in Chrome or Edge).
 * Saving writes back to that same file. Resolves null if it couldn't be read (the user has been told why).
 */
export async function openLaunchedDiagram(handle: FileSystemHandle): Promise<Diagram | null> {
  if (handle.kind !== "file") return null;
  const fileHandle = handle as FileSystemFileHandle;
  let file: File;
  try {
    file = await fileHandle.getFile();
  } catch (error) {
    console.error(error);
    toast.error("Couldn't open the file", { description: "Please try again, or use Open a diagram file." });
    return null;
  }
  return openDiagramFile(file, fileHandle);
}

async function openDiagramFile(file: File, handle: FileSystemFileHandle | null): Promise<Diagram | null> {
  try {
    const { diagram, fixes } = await parseDiagramFile(file);
    startDiagram(diagram, { handle, fileName: file.name });
    if (fixes.length) {
      toast.warning(`Opened "${diagram.name}" with repairs`, {
        description: "Some parts of the file needed fixing. Save to keep the repaired version.",
        details: fixes,
      });
    }
    return diagram;
  } catch (error) {
    toast.error(`Couldn't open "${file.name}"`, {
      description: error instanceof DiagramFileError ? error.message : "Please check it's a diagram saved from Building Block.",
    });
    return null;
  }
}
