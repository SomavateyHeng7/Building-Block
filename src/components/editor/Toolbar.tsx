"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTheme } from "next-themes";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import {
  downloadBlob,
  openDiagramFromDevice,
  saveDiagramToFile,
  startDiagram,
  supportsFilePicker,
  useFileStore,
  useIsDirty,
} from "@/lib/diagram/file";
import { createBlankDiagram } from "@/lib/diagram/factory";
import {
  canvasToPng,
  componentsCsv,
  connectionsCsv,
  exportTitle,
  legendUsedIn,
  pdfFromPages,
  renderComposite,
  renderSvg,
  type RenderedComposite,
} from "@/lib/diagram/export";
import { DATA_FORMATS, IMAGE_FORMATS, describeFiles, planExport, type ExportFormat } from "@/lib/diagram/exportPlan";
import { createZip } from "@/lib/zip";
import ExportDialog, { type ExportChoice, type ExportPrefs } from "./ExportDialog";
import { toast } from "@/lib/toast";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { Icon } from "./Icon";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/theme-toggle";

const SECONDARY_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-60 sm:px-3 dark:border-zinc-700 dark:hover:bg-zinc-900";
const GHOST_BUTTON =
  "inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 aria-expanded:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:aria-expanded:bg-zinc-800";
const ICON_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";
const MENU =
  "absolute z-50 mt-1.5 w-60 max-w-[calc(100vw-1rem)] rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900";
const DIVIDER = "mx-1 hidden h-5 w-px bg-zinc-200 sm:block dark:bg-zinc-800";

const EXPORT_PREFS_KEY = "bb:export";
/** Earlier versions remembered only the picture style, under this key. */
const OLD_EXPORT_THEME_KEY = "bb:exportTheme";
const ALL_FORMATS = [...IMAGE_FORMATS, ...DATA_FORMATS];

/** The last export's choices, so the dialog opens the way it was left. */
function readExportPrefs(): ExportPrefs {
  const fallback: ExportPrefs = { formats: ["png"], bundle: "one", theme: "light" };
  try {
    const saved = JSON.parse(window.localStorage.getItem(EXPORT_PREFS_KEY) ?? "{}");
    const formats = Array.isArray(saved.formats) ? saved.formats.filter((f: ExportFormat) => ALL_FORMATS.includes(f)) : [];
    const oldTheme = window.localStorage.getItem(OLD_EXPORT_THEME_KEY);
    return {
      formats: formats.length ? formats : fallback.formats,
      bundle: saved.bundle === "separate" ? "separate" : "one",
      theme: (saved.theme ?? oldTheme) === "dark" ? "dark" : "light",
    };
  } catch {
    return fallback;
  }
}

function saveExportPrefs(prefs: ExportPrefs) {
  try {
    window.localStorage.setItem(EXPORT_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // The choices just aren't remembered.
  }
}

/** Browsers drop downloads fired back to back. */
const BETWEEN_DOWNLOADS_MS = 400;

const MENU_ITEM =
  "flex w-full items-center justify-between gap-4 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800";

function FileMenu({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
}: {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}) {
  const [open, setOpen] = useState(false);
  const mod = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
  const items = [
    { label: "New diagram", run: onNew, keys: "" },
    { label: "Open…", run: onOpen, keys: "" },
    { label: "Save", run: onSave, keys: `${mod}S` },
    { label: supportsFilePicker() ? "Save as…" : "Download a copy", run: onSaveAs, keys: supportsFilePicker() ? `${mod}⇧S` : "" },
  ];
  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button type="button" aria-haspopup="menu" aria-expanded={open} className={GHOST_BUTTON} onClick={() => setOpen((value) => !value)}>
        File
        <Icon name="chevronDown" className="h-3.5 w-3.5 opacity-60" />
      </button>
      {open && (
        <div role="menu" className={`${MENU} left-0`}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={MENU_ITEM}
              onClick={() => {
                setOpen(false);
                item.run();
              }}
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-[11px] text-zinc-500">{item.keys}</span>
            </button>
          ))}
          {!supportsFilePicker() && (
            <p className="mt-1 border-t border-zinc-200 px-2 pb-1 pt-2 text-[11px] leading-snug text-zinc-500 dark:border-zinc-700">
              This browser can&apos;t save over a file, so Save downloads a new copy each time. Chrome or Edge can save in place.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** What has happened to the diagram since it was last written to a file. */
function SaveStatus() {
  const dirty = useIsDirty();
  const { fileName, handle, saving, error } = useFileStore();
  const pill = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium";
  const dot = (color: string) => <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${color}`} />;
  if (error) {
    return (
      <span role="alert" className={`${pill} bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300`}>
        {dot("bg-red-500")}Not saved
      </span>
    );
  }
  if (saving) return <span className={`${pill} text-zinc-500`}>{dot("animate-pulse bg-zinc-400")}Saving…</span>;
  if (dirty) {
    return (
      <span
        className={`${pill} bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300`}
        title={handle ? "Saving to the file in a moment." : "Not in a file yet. Save to keep it: Building Block doesn't store diagrams."}
      >
        {dot("bg-amber-500")}
        <span className="hidden sm:inline">{handle ? "Unsaved changes" : "Not saved to a file"}</span>
        <span className="sm:hidden">Unsaved</span>
      </span>
    );
  }
  if (fileName) {
    return (
      <span className={`${pill} min-w-0 text-zinc-500`} title={`Saved to ${fileName}`}>
        {dot("bg-emerald-500")}
        <span className="hidden max-w-48 truncate md:inline">{fileName}</span>
        <span className="md:hidden">Saved</span>
      </span>
    );
  }
  return null;
}

export default function Toolbar({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  const router = useRouter();
  const { getNodes, getNodesBounds } = useReactFlow();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [exportOpen, setExportOpen] = useState(false);
  const diagram = useDiagramStore((state) => state.diagram);
  const renameDiagram = useDiagramStore((state) => state.renameDiagram);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  const canUndo = useDiagramStore((state) => state.past.length > 0);
  const canRedo = useDiagramStore((state) => state.future.length > 0);
  const [exporting, setExporting] = useState(false);
  const { guard: guardUnsaved, dialog: unsavedDialog } = useUnsavedGuard();
  const hasFile = useFileStore((state) => state.handle !== null);
  const saving = useFileStore((state) => state.saving);
  const dirty = useIsDirty();

  const section = getActiveSection(diagram);

  function handleNew() {
    guardUnsaved(() => startDiagram(createBlankDiagram()));
  }

  function handleOpen() {
    // The file picker has to start from the click, so ask about unsaved changes only if there are any.
    guardUnsaved(() => void openDiagramFromDevice(), {
      picker: { continueLabel: "Open…", next: "Now choose the diagram to open." },
    });
  }

  function handleLeave() {
    guardUnsaved(() => {
      // Leaving closes the diagram: it's in its file (or was deliberately discarded), not kept here.
      useFileStore.setState({ opened: false });
      router.push("/diagrams");
    });
  }

  const nextFrames = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  /** Waits until the canvas shows the section's nodes with measured sizes. */
  async function waitForSection(nodeCount: number) {
    for (let attempt = 0; attempt < 40; attempt++) {
      await nextFrames();
      const nodes = getNodes();
      if (nodes.length === nodeCount && nodes.every((node) => node.measured?.width && node.measured?.height)) return;
    }
  }

  /** Puts the app in the picture style while images render (they're drawn from the live page). */
  async function inTheme<T>(style: "light" | "dark", run: () => Promise<T>): Promise<T> {
    if (resolvedTheme === style) return run();
    const previous = theme;
    setTheme(style);
    for (let attempt = 0; attempt < 40; attempt++) {
      await nextFrames();
      if (document.documentElement.classList.contains("dark") === (style === "dark")) break;
    }
    await nextFrames();
    try {
      return await run();
    } finally {
      if (previous) setTheme(previous);
    }
  }

  /**
   * Makes the chosen files and downloads them, as one .zip or one by one. The canvas only renders one view,
   * so it steps through the views being pictured, then puts back what was open.
   */
  async function runExport(choice: ExportChoice) {
    setExportOpen(false);
    saveExportPrefs({ formats: choice.formats, bundle: choice.bundle, theme: choice.theme });
    const plan = planExport(diagram, choice);
    if (!plan.files.length) return;

    const originalId = diagram.activeSectionId;
    const originalDetailId = diagram.activeDetailId;
    const { setActiveSection, openDetail } = useDiagramStore.getState();
    const pictured = [...new Map(plan.files.flatMap((file) => file.views).map((view) => [view.id, view])).values()];
    const needs = (format: ExportFormat) => plan.files.some((file) => file.format === format);
    setExporting(true);
    setSelection([]);
    useDiagramStore.getState().setSelectedEdge(null);
    try {
      // Render each pictured view once, in whichever forms the chosen formats need.
      const pages = new Map<string, RenderedComposite>();
      const svgs = new Map<string, Blob>();
      if (pictured.length) {
        await inTheme(choice.theme, async () => {
          for (const target of pictured) {
            setActiveSection(target.sectionId);
            if (target.componentId) openDetail(target.componentId);
            const view = getActiveSection(useDiagramStore.getState().diagram);
            await waitForSection(view.nodes.length);
            const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
            if (!viewport) throw new Error("The canvas isn't showing");
            const options = {
              viewport,
              bounds: getNodesBounds(getNodes()),
              title: exportTitle(diagram, view),
              legend: legendUsedIn(diagram, view),
              dark: choice.theme === "dark",
            };
            if (needs("png") || needs("pdf")) pages.set(target.id, await renderComposite(options));
            if (needs("svg")) svgs.set(target.id, await renderSvg(options));
          }
        });
      }

      const blobs: { name: string; blob: Blob }[] = [];
      for (const file of plan.files) {
        const blob =
          file.format === "png"
            ? await canvasToPng(pages.get(file.views[0].id)!.canvas)
            : file.format === "pdf"
              ? await pdfFromPages(file.views.map((view) => pages.get(view.id)!))
              : file.format === "svg"
                ? svgs.get(file.views[0].id)!
                : file.format === "components-csv"
                  ? componentsCsv(diagram)
                  : file.format === "connections-csv"
                    ? connectionsCsv(diagram)
                    : new Blob([JSON.stringify(diagram, null, 2)], { type: "application/json" });
        blobs.push({ name: file.name, blob });
      }

      if (plan.zipName) {
        const entries = await Promise.all(
          blobs.map(async ({ name, blob }) => ({ name, data: new Uint8Array(await blob.arrayBuffer()) })),
        );
        downloadBlob(new Blob([createZip(entries) as BlobPart], { type: "application/zip" }), plan.zipName);
        toast.success(`Downloaded ${plan.zipName}`, { description: `A zip with ${describeFiles(plan.files)}.` });
      } else {
        for (const [index, { name, blob }] of blobs.entries()) {
          if (index) await new Promise((resolve) => setTimeout(resolve, BETWEEN_DOWNLOADS_MS));
          downloadBlob(blob, name);
        }
        if (blobs.length === 1) {
          toast.success(`Downloaded ${blobs[0].name}`, {
            description: plan.files[0].format === "json" ? "Open it again any time with File → Open." : undefined,
          });
        } else {
          toast.success(`Downloaded ${blobs.length} files`, {
            description: "If some are missing, allow this site to download several files, then try again.",
            details: blobs.map((entry) => entry.name),
          });
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Couldn't export", {
        description: "Please try again. If it keeps failing, save the diagram with File → Save so your work is safe.",
      });
    } finally {
      if (pictured.length) {
        setActiveSection(originalId);
        if (originalDetailId) openDetail(originalDetailId);
      }
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-zinc-200 bg-white px-2 py-1.5 sm:gap-x-1.5 sm:px-3 dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        title="Back to the start page"
        aria-label="Back to the start page"
        className="group inline-flex h-8 shrink-0 items-center gap-1 rounded-md pl-1 pr-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        onClick={handleLeave}
      >
        <Icon name="arrowLeft" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        <LogoMark className="h-6 w-6" />
      </button>
      <div className={DIVIDER} />
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          aria-label="Diagram name"
          title="Click to rename this diagram"
          placeholder="Name this diagram"
          maxLength={80}
          size={Math.min(Math.max(diagram.name.length, 8), 32)}
          className="h-8 min-w-0 max-w-[45vw] rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold outline-none transition-colors placeholder:font-normal placeholder:text-zinc-400 hover:border-zinc-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:max-w-none dark:hover:border-zinc-700"
          value={diagram.name}
          onChange={(event) => renameDiagram(event.target.value)}
          onFocus={(event) => event.target.select()}
          // An empty name would leave blank file names.
          onBlur={(event) => {
            if (!event.target.value.trim()) renameDiagram("Untitled Diagram");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <SaveStatus />
      </div>
      <FileMenu
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={() => void saveDiagramToFile()}
        onSaveAs={() => void saveDiagramToFile({ saveAs: true })}
      />

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <button type="button" title="Undo (Ctrl/⌘+Z)" aria-label="Undo" disabled={!canUndo} onClick={undo} className={ICON_BUTTON}>
          <Icon name="undo" />
        </button>
        <button type="button" title="Redo (Ctrl/⌘+Shift+Z)" aria-label="Redo" disabled={!canRedo} onClick={redo} className={ICON_BUTTON}>
          <Icon name="redo" />
        </button>
        <span className="hidden pointer-fine:contents">
          <button type="button" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={onShowShortcuts} className={ICON_BUTTON}>
            <Icon name="keyboard" />
          </button>
        </span>
        <div className={DIVIDER} />
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <div className={DIVIDER} />
        <button
          type="button"
          className={`${SECONDARY_BUTTON} ${dirty && !hasFile ? "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900" : ""}`}
          disabled={saving}
          title={hasFile ? "Saves to the open file (Ctrl/⌘+S)" : "Choose where to save the file (Ctrl/⌘+S)"}
          onClick={() => void saveDiagramToFile()}
        >
          <Icon name="save" />
          <span className="hidden sm:inline">Save</span>
        </button>
        <button
          type="button"
          disabled={exporting}
          aria-haspopup="dialog"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          onClick={() => setExportOpen(true)}
        >
          <Icon name="download" />
          {exporting ? "Exporting…" : "Export"}
        </button>
      </div>
      {unsavedDialog}
      {exportOpen && (
        <ExportDialog
          diagram={diagram}
          currentViewId={section.id}
          prefs={readExportPrefs()}
          onCancel={() => setExportOpen(false)}
          onExport={(choice) => void runExport(choice)}
        />
      )}
    </div>
  );
}
