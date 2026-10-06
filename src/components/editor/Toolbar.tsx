"use client";

import Link from "next/link";
import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTheme } from "next-themes";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { useSaveStatus } from "@/lib/diagram/saveStatus";
import { downloadDiagramJson } from "@/lib/diagram/persistence";
import { backupState, formatAge, hasContent, useLastBackup } from "@/lib/diagram/backup";
import type { Diagram } from "@/lib/diagram/types";
import {
  downloadCanvasPng,
  exportComponentsCsv,
  exportPdf,
  exportPdfPages,
  exportPng,
  exportSvg,
  exportTitle,
  legendUsedIn,
  renderComposite,
  type RenderedComposite,
} from "@/lib/diagram/export";
import { nextSlotInContainer } from "@/lib/diagram/layout";
import { saveUserTemplate } from "@/templates/userTemplates";
import { toast } from "@/lib/toast";
import TemplateNameDialog from "./TemplateNameDialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { ImportDiagramButton } from "@/components/ImportDiagramButton";

const SECONDARY_BUTTON =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

type ExportTheme = "light" | "dark";
const EXPORT_THEME_KEY = "bb:exportTheme";

function readExportTheme(): ExportTheme {
  try {
    return window.localStorage.getItem(EXPORT_THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

type ExportFormat = "png" | "pdf" | "svg" | "png-all" | "pdf-all" | "csv" | "json";

const EXPORT_OPTIONS: { format: ExportFormat; label: string; hint: string }[] = [
  { format: "png", label: "PNG image", hint: "Current tab, with legend" },
  { format: "pdf", label: "PDF document", hint: "Current tab, with legend" },
  { format: "svg", label: "SVG vector", hint: "Current tab, editable title and legend" },
  { format: "png-all", label: "PNG images (all tabs)", hint: "One file per tab, with legend" },
  { format: "pdf-all", label: "PDF document (all tabs)", hint: "One page per tab, with legend" },
  { format: "csv", label: "Component list (CSV)", hint: "All tabs, with details" },
  { format: "json", label: "Diagram file (JSON)", hint: "Re-importable backup" },
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
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        onClick={() => setOpen((value) => !value)}
      >
        {busy ? "Exporting…" : "Export ▾"}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="border-b border-zinc-200 px-3 pb-2 pt-1.5 dark:border-zinc-700">
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
              className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
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

export default function Toolbar() {
  const { getNodes, getNodesBounds } = useReactFlow();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [exportTheme, setExportTheme] = useState<ExportTheme>(readExportTheme);
  const diagram = useDiagramStore((state) => state.diagram);
  const selectedNodeIds = useDiagramStore((state) => state.selectedNodeIds);
  const renameDiagram = useDiagramStore((state) => state.renameDiagram);
  const addContainer = useDiagramStore((state) => state.addContainer);
  const addBlock = useDiagramStore((state) => state.addBlock);
  const deleteNodes = useDiagramStore((state) => state.deleteNodes);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const setShowTechnology = useDiagramStore((state) => state.setShowTechnology);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  const canUndo = useDiagramStore((state) => state.past.length > 0);
  const canRedo = useDiagramStore((state) => state.future.length > 0);
  const [exporting, setExporting] = useState(false);
  const [namingTemplate, setNamingTemplate] = useState(false);
  const saveStatus = useSaveStatus();

  const section = getActiveSection(diagram);
  const nodeCount = section.nodes.length;
  const showTechnology = diagram.showTechnology !== false;
  const singleSelected =
    selectedNodeIds.length === 1 ? section.nodes.find((node) => node.id === selectedNodeIds[0]) : undefined;

  const nextPosition = () => ({
    x: 80 + (nodeCount % 5) * 48,
    y: 80 + Math.floor(nodeCount / 5) * 48,
  });

  // With a container (or a block inside one) selected, "+ Block" adds below that container's last block.
  function handleAddBlock() {
    const containerId =
      singleSelected?.type === "container" ? singleSelected.id : singleSelected?.parentId;
    if (containerId) addBlock(nextSlotInContainer(section.nodes, containerId), containerId);
    else addBlock(nextPosition());
  }

  function handleSaveTemplate(name: string) {
    setNamingTemplate(false);
    if (saveUserTemplate(diagram, name)) {
      toast.success(`Saved template "${name}"`, { details: ["Find it under My templates on the Templates page."] });
    } else {
      toast.error("Couldn't save the template", { details: ["Browser storage is full or blocked."] });
    }
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
    if (format === "json" || format === "csv" || resolvedTheme === exportTheme) return runExport(format);
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
      toast.success("Diagram file downloaded", { details: ["Re-import it any time from Import."] });
      return;
    }
    if (format === "csv") {
      exportComponentsCsv(diagram);
      toast.success("Component list downloaded");
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href="/diagrams"
        className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← My diagrams
      </Link>
      <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
      <input
        aria-label="Diagram name"
        title="Click to rename this diagram"
        placeholder="Name this diagram"
        maxLength={80}
        className="w-48 rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-zinc-400 hover:border-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:hover:border-zinc-600"
        value={diagram.name}
        onChange={(event) => renameDiagram(event.target.value)}
        onFocus={(event) => event.target.select()}
        // An empty name would leave a nameless entry in My diagrams and blank file names.
        onBlur={(event) => {
          if (!event.target.value.trim()) renameDiagram("Untitled Diagram");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {saveStatus === "error" ? (
        <span
          role="alert"
          className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
          title="The browser refused to store this diagram (storage full, blocked or private mode). Export it as JSON so you don't lose it."
        >
          Not saved — export JSON to keep your work
        </span>
      ) : saveStatus === "saved" ? (
        <span className="text-xs text-zinc-400" title="Diagrams are stored only in this browser. Export JSON to back up or move one.">
          Saved in this browser
        </span>
      ) : null}
      <BackupStatus diagram={diagram} />
      <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          title="Undo (Ctrl/⌘+Z)"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={undo}
          className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
        </button>
        <button
          type="button"
          title="Redo (Ctrl/⌘+Shift+Z)"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={redo}
          className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 14 5-5-5-5" />
            <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
          </svg>
        </button>
      </div>
      <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
      <button
        type="button"
        className={SECONDARY_BUTTON}
        onClick={() => addContainer(nextPosition())}
      >
        + Container
      </button>
      <button
        type="button"
        className={SECONDARY_BUTTON}
        title="With a container selected, the block is added inside it"
        onClick={handleAddBlock}
      >
        + Block
      </button>
      {selectedNodeIds.length > 0 && (
        <button
          type="button"
          className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          onClick={() => deleteNodes(selectedNodeIds)}
        >
          Delete{selectedNodeIds.length > 1 ? ` ${selectedNodeIds.length}` : ""}
        </button>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label
          className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300"
          title="Show each component's technology under its name"
        >
          <input
            type="checkbox"
            checked={showTechnology}
            onChange={(event) => setShowTechnology(event.target.checked)}
            className="accent-zinc-900 dark:accent-zinc-100"
          />
          Show technology
        </label>
        <ThemeToggle />
        <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
        <button type="button" className={SECONDARY_BUTTON} onClick={() => setNamingTemplate(true)}>
          Save as template
        </button>
        <ImportDiagramButton className={SECONDARY_BUTTON} />
        <ExportMenu imageTheme={exportTheme} onImageThemeChange={changeExportTheme} multiTab={diagram.sections.length > 1} busy={exporting} onSelect={handleExport} />
      </div>
      {namingTemplate && (
        <TemplateNameDialog
          initialName={diagram.name}
          onSave={handleSaveTemplate}
          onCancel={() => setNamingTemplate(false)}
        />
      )}
    </div>
  );
}

const BACKUP_HELP =
  "Diagrams live only in this browser. Clearing site data, or 7 days without visiting in Safari, deletes them. A JSON backup can be re-imported any time.";

/** Whether the latest changes are covered by a downloaded JSON backup; one click makes one. */
function BackupStatus({ diagram }: { diagram: Diagram }) {
  const lastBackup = useLastBackup(diagram.id);
  const state = backupState(diagram, lastBackup);

  if (state === "current") {
    return (
      <span className="text-xs text-zinc-400" title={`Backup downloaded ${formatAge(lastBackup!)}.`}>
        · Backed up
      </span>
    );
  }
  if (!hasContent(diagram)) return null;

  return (
    <button
      type="button"
      title={`${BACKUP_HELP}${lastBackup ? ` Last backup: ${formatAge(lastBackup)}.` : ""} Click to download one now.`}
      className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
      onClick={() => {
        downloadDiagramJson(diagram);
        toast.success("Backup downloaded", { details: ["Re-import it any time from Import."] });
      }}
    >
      {state === "never" ? "Not backed up" : "Changed since backup"}
    </button>
  );
}
