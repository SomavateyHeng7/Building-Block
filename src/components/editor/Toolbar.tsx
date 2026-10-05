"use client";

import Link from "next/link";
import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTheme } from "next-themes";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { useSaveStatus } from "@/lib/diagram/saveStatus";
import { downloadDiagramJson } from "@/lib/diagram/persistence";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { ImportDiagramButton } from "@/components/ImportDiagramButton";

const SECONDARY_BUTTON =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

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
  onSelect,
}: {
  busy: boolean;
  multiTab: boolean;
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
  const { resolvedTheme } = useTheme();
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

  function handleSaveTemplate() {
    const name = window.prompt("Template name", diagram.name)?.trim();
    if (!name) return;
    if (saveUserTemplate(diagram, name)) {
      window.alert(`Saved "${name}". It's under My templates on the Templates page.`);
    } else {
      window.alert("Couldn't save the template: browser storage is full or blocked.");
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
          dark: resolvedTheme === "dark",
          filename: exportTitle(diagram, target),
        });
        pages.push({ name: exportTitle(diagram, target), page });
      }
      if (!pages.length) {
        window.alert("There's nothing to export yet.");
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
    } catch (error) {
      console.error(error);
      window.alert("Export failed. Please try again.");
    } finally {
      setActiveSection(originalId);
      setExporting(false);
    }
  }

  async function handleExport(format: ExportFormat) {
    if (format === "json") return downloadDiagramJson(diagram);
    if (format === "csv") return exportComponentsCsv(diagram);
    if (format === "png-all" || format === "pdf-all") return handleExportAll(format);

    const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
    const nodes = getNodes();
    if (!viewport || !nodes.length) {
      window.alert("There's nothing on this tab to export yet.");
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
        dark: resolvedTheme === "dark",
        filename: exportTitle(diagram, section),
      };
      await (format === "png" ? exportPng(options) : format === "svg" ? exportSvg(options) : exportPdf(options));
    } catch (error) {
      console.error(error);
      window.alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href="/diagrams"
        className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← My diagrams
      </Link>
      <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
      <input
        className="rounded border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none hover:border-zinc-300 focus:border-zinc-400 dark:hover:border-zinc-700"
        value={diagram.name}
        onChange={(event) => renameDiagram(event.target.value)}
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

      <div className="ml-auto flex items-center gap-2">
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
        <button type="button" className={SECONDARY_BUTTON} onClick={handleSaveTemplate}>
          Save as template
        </button>
        <ImportDiagramButton className={SECONDARY_BUTTON} />
        <ExportMenu multiTab={diagram.sections.length > 1} busy={exporting} onSelect={handleExport} />
      </div>
    </div>
  );
}
