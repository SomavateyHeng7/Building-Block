"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTheme } from "next-themes";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import {
  downloadDiagramJson,
  isDirty,
  openDiagramFromDevice,
  saveDiagramToFile,
  startDiagram,
  supportsFilePicker,
  useFileStore,
  useIsDirty,
} from "@/lib/diagram/file";
import { createBlankDiagram } from "@/lib/diagram/factory";
import {
  downloadCanvasPng,
  exportComponentsCsv,
  exportConnectionsCsv,
  exportPdf,
  exportPdfPages,
  exportPng,
  exportSvg,
  exportTitle,
  legendUsedIn,
  renderComposite,
  type RenderedComposite,
} from "@/lib/diagram/export";
import { toast } from "@/lib/toast";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
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

type ExportTheme = "light" | "dark";
const EXPORT_THEME_KEY = "bb:exportTheme";

function readExportTheme(): ExportTheme {
  try {
    return window.localStorage.getItem(EXPORT_THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

type ExportFormat = "png" | "pdf" | "svg" | "png-all" | "pdf-all" | "csv" | "connections-csv" | "json";

const EXPORT_OPTIONS: { format: ExportFormat; label: string; hint: string }[] = [
  { format: "png", label: "PNG image", hint: "Current tab, with legend" },
  { format: "pdf", label: "PDF document", hint: "Current tab, with legend" },
  { format: "svg", label: "SVG vector", hint: "Current tab, editable title and legend" },
  { format: "png-all", label: "PNG images (all tabs)", hint: "One file per tab, with legend" },
  { format: "pdf-all", label: "PDF document (all tabs)", hint: "One page per tab, with legend" },
  { format: "csv", label: "Component list (CSV)", hint: "All tabs, with details" },
  { format: "connections-csv", label: "Connection list (CSV)", hint: "All tabs: from, to, protocol, what flows" },
  { format: "json", label: "Diagram file (JSON)", hint: "A copy you can re-open with Open" },
];

function ExportMenu({
  busy,
  multiTab,
  imageTheme,
  onImageThemeChange,
  onSelect,
}: {
  busy: boolean;
  multiTab: boolean;
  imageTheme: ExportTheme;
  onImageThemeChange: (theme: ExportTheme) => void;
  onSelect: (format: ExportFormat) => void;
}) {
  const [open, setOpen] = useState(false);
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
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="download" />
        {busy ? "Exporting…" : "Export"}
        <Icon name="chevronDown" className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div
          role="menu"
          className={`${MENU} right-0 max-h-[70dvh] overflow-y-auto overflow-x-hidden`}
        >
          <div className="mb-1 border-b border-zinc-200 px-2 pb-2 pt-1.5 dark:border-zinc-700">
            <p id="export-style-label" className="mb-1 text-[11px] font-medium text-zinc-500">
              Image style (PNG, PDF, SVG)
            </p>
            <div role="radiogroup" aria-labelledby="export-style-label" className="flex overflow-hidden rounded border border-zinc-300 text-xs font-medium dark:border-zinc-700">
              {(["light", "dark"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={imageTheme === value}
                  className={`flex-1 px-2 py-1 capitalize ${
                    imageTheme === value
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                  onClick={() => onImageThemeChange(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          {EXPORT_OPTIONS.filter((option) => multiTab || !option.format.endsWith("-all")).map((option) => (
            <button
              key={option.format}
              type="button"
              role="menuitem"
              className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => {
                setOpen(false);
                onSelect(option.format);
              }}
            >
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-[11px] text-zinc-500">{option.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [exportTheme, setExportTheme] = useState<ExportTheme>(readExportTheme);
  const diagram = useDiagramStore((state) => state.diagram);
  const renameDiagram = useDiagramStore((state) => state.renameDiagram);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  const canUndo = useDiagramStore((state) => state.past.length > 0);
  const canRedo = useDiagramStore((state) => state.future.length > 0);
  const [exporting, setExporting] = useState(false);
  // An action waiting on the unsaved-changes dialog.
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const hasFile = useFileStore((state) => state.handle !== null);
  const saving = useFileStore((state) => state.saving);
  const dirty = useIsDirty();

  const section = getActiveSection(diagram);

  /** Runs `action` now, or after the user has decided what to do with unsaved changes. */
  function guardUnsaved(action: () => void) {
    if (isDirty()) setPendingAction(() => action);
    else action();
  }

  function handleNew() {
    guardUnsaved(() => startDiagram(createBlankDiagram()));
  }

  function handleOpen() {
    // The file picker has to start from the click, so ask about unsaved changes only if there are any.
    guardUnsaved(() => void openDiagramFromDevice());
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

  /** The canvas only renders the active tab, so step through the tabs and put the original one back after. */
  async function handleExportAll(format: "png-all" | "pdf-all") {
    const originalId = diagram.activeSectionId;
    const { setActiveSection } = useDiagramStore.getState();
    setExporting(true);
    setSelection([]);
    useDiagramStore.getState().setSelectedEdge(null);
    try {
      const pages: { name: string; page: RenderedComposite }[] = [];
      for (const target of diagram.sections) {
        if (!target.nodes.length) continue;
        setActiveSection(target.id);
        await waitForSection(target.nodes.length);
        const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
        if (!viewport) continue;
        const page = await renderComposite({
          viewport,
          bounds: getNodesBounds(getNodes()),
          title: exportTitle(diagram, target),
          legend: legendUsedIn(diagram, target),
          dark: exportTheme === "dark",
          filename: exportTitle(diagram, target),
        });
        pages.push({ name: exportTitle(diagram, target), page });
      }
      if (!pages.length) {
        toast.info("There's nothing to export yet", { details: ["Add a container or component first."] });
        return;
      }
      if (format === "pdf-all") {
        await exportPdfPages(pages.map((entry) => entry.page), diagram.name);
      } else {
        for (const entry of pages) {
          await downloadCanvasPng(entry.page.canvas, entry.name);
          // Browsers drop downloads fired back to back.
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
      toast.success(format === "pdf-all" ? "PDF downloaded" : `${pages.length} PNG files downloaded`);
    } catch (error) {
      console.error(error);
      toast.error("Export failed", { details: ["Please try again. If it keeps failing, export the diagram as JSON to keep your work."] });
    } finally {
      setActiveSection(originalId);
      setExporting(false);
    }
  }

  function changeExportTheme(next: ExportTheme) {
    setExportTheme(next);
    try {
      window.localStorage.setItem(EXPORT_THEME_KEY, next);
    } catch {
      // The choice just isn't remembered.
    }
  }

  /**
   * Images are drawn from the live page, so the app itself has to be in the chosen style while
   * they render. Switch the theme, export, then put the user's theme back.
   */
  async function handleExport(format: ExportFormat) {
    if (format === "json" || format === "csv" || format === "connections-csv" || resolvedTheme === exportTheme) return runExport(format);
    const previous = theme;
    setTheme(exportTheme);
    for (let attempt = 0; attempt < 40; attempt++) {
      await nextFrames();
      if (document.documentElement.classList.contains("dark") === (exportTheme === "dark")) break;
    }
    await nextFrames();
    try {
      await runExport(format);
    } finally {
      if (previous) setTheme(previous);
    }
  }

  async function runExport(format: ExportFormat) {
    if (format === "json") {
      downloadDiagramJson(diagram);
      toast.success("Diagram file downloaded", { details: ["Re-open it any time with File → Open."] });
      return;
    }
    if (format === "csv") {
      exportComponentsCsv(diagram);
      toast.success("Component list downloaded");
      return;
    }
    if (format === "connections-csv") {
      exportConnectionsCsv(diagram);
      toast.success("Connection list downloaded");
      return;
    }
    if (format === "png-all" || format === "pdf-all") return handleExportAll(format);

    const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
    const nodes = getNodes();
    if (!viewport || !nodes.length) {
      toast.info("There's nothing on this tab to export yet", { details: ["Add a container or component first."] });
      return;
    }
    setExporting(true);
    // Clear the selection first so handles and highlight outlines aren't in the picture.
    setSelection([]);
    useDiagramStore.getState().setSelectedEdge(null);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const options = {
        viewport,
        bounds: getNodesBounds(nodes),
        title: exportTitle(diagram, section),
        legend: legendUsedIn(diagram, section),
        dark: exportTheme === "dark",
        filename: exportTitle(diagram, section),
      };
      await (format === "png" ? exportPng(options) : format === "svg" ? exportSvg(options) : exportPdf(options));
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch (error) {
      console.error(error);
      toast.error("Export failed", { details: ["Please try again. If it keeps failing, export the diagram as JSON to keep your work."] });
    } finally {
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
        <ExportMenu imageTheme={exportTheme} onImageThemeChange={changeExportTheme} multiTab={diagram.sections.length > 1} busy={exporting} onSelect={handleExport} />
      </div>
      {pendingAction && (
        <UnsavedChangesDialog
          name={diagram.name}
          needsLocation={!hasFile}
          onCancel={() => setPendingAction(null)}
          onDiscard={() => {
            const action = pendingAction;
            setPendingAction(null);
            action();
          }}
          onSave={async () => {
            const action = pendingAction;
            if (await saveDiagramToFile()) {
              setPendingAction(null);
              action();
            }
          }}
        />
      )}
    </div>
  );
}
