"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import Canvas from "./Canvas";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar";
import PropertiesPanel from "./PropertiesPanel";
import LegendPanel from "./LegendPanel";
import SectionTabs from "./SectionTabs";
import ShortcutsHelp from "./ShortcutsHelp";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { nextSlotInContainer, nudgeNodes } from "@/lib/diagram/layout";
import { createBlankDiagram } from "@/lib/diagram/factory";
import {
  getDiagramIndexServerSnapshot,
  getDiagramIndexSnapshot,
  loadDiagramFromStorage,
  saveDiagram,
  subscribeDiagramIndex,
} from "@/lib/diagram/persistence";
import { useMounted } from "@/components/theme-toggle";
import { setSaveStatus } from "@/lib/diagram/saveStatus";

interface EditorAppProps {
  diagramId: string;
}

export default function EditorApp({ diagramId }: EditorAppProps) {
  const router = useRouter();
  const diagram = useDiagramStore((state) => state.diagram);
  const loadDiagram = useDiagramStore((state) => state.loadDiagram);
  const hydratedForId = useRef<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const mounted = useMounted();
  const savedDiagrams = useSyncExternalStore(
    subscribeDiagramIndex,
    getDiagramIndexSnapshot,
    getDiagramIndexServerSnapshot,
  );
  // A link to a diagram that isn't in this browser. Only judged after mount, once storage can be read.
  const missing =
    mounted &&
    diagramId !== "new" &&
    diagram.id !== diagramId &&
    !savedDiagrams.some((entry) => entry.id === diagramId);

  useEffect(() => {
    if (hydratedForId.current === diagramId) return;
    hydratedForId.current = diagramId;

    if (diagramId !== "new") {
      // Just created and redirected here: it is already in the store, even if storage refused it.
      if (useDiagramStore.getState().diagram.id === diagramId) return;
      const existing = loadDiagramFromStorage(diagramId);
      if (existing) loadDiagram(existing);
      return;
    }

    const blank = createBlankDiagram();
    loadDiagram(blank);
    setSaveStatus(saveDiagram(blank) ? "saved" : "error");
    router.replace(`/editor/${blank.id}`);
  }, [diagramId, loadDiagram, router]);

  // Editing shortcuts. Text fields keep their native behaviour (text undo, copy/paste, select all).
  // Delete/Backspace is handled by React Flow on the canvas.
  useEffect(() => {
    const NUDGE: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, [contenteditable='true'], [role='dialog']")) return;

      const store = useDiagramStore.getState();
      const hasSelection = store.selectedNodeIds.length > 0;

      if (!(event.metaKey || event.ctrlKey)) {
        const section = getActiveSection(store.diagram);
        const nudge = NUDGE[event.key];
        if (nudge && hasSelection) {
          const step = event.shiftKey ? 32 : 8;
          const nodes = nudgeNodes(section.nodes, store.selectedNodeIds, nudge[0] * step, nudge[1] * step);
          store.setActiveSectionNodes(nodes, { coalesceKey: `nudge:${store.selectedNodeIds.join(",")}` });
        } else if (event.key === "Escape") store.setSelection([]);
        else if (event.key === "?") setHelpOpen((open) => !open);
        else if (event.key.toLowerCase() === "c" && !event.shiftKey) {
          const count = section.nodes.length;
          store.addContainer({ x: 80 + (count % 5) * 48, y: 80 + Math.floor(count / 5) * 48 });
        } else if (event.key.toLowerCase() === "b" && !event.shiftKey) {
          const selected =
            store.selectedNodeIds.length === 1
              ? section.nodes.find((node) => node.id === store.selectedNodeIds[0])
              : undefined;
          const containerId = selected?.type === "container" ? selected.id : selected?.parentId;
          const count = section.nodes.length;
          if (containerId) store.addBlock(nextSlotInContainer(section.nodes, containerId), containerId);
          else store.addBlock({ x: 80 + (count % 5) * 48, y: 80 + Math.floor(count / 5) * 48 });
        } else return;
        event.preventDefault();
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) store.undo();
      else if ((key === "z" && event.shiftKey) || key === "y") store.redo();
      else if (key === "c" && hasSelection) store.copySelection();
      else if (key === "x" && hasSelection) {
        store.copySelection();
        store.deleteNodes(store.selectedNodeIds);
      } else if (key === "v") store.paste();
      else if (key === "d" && hasSelection) store.duplicateSelection();
      else if (key === "a") store.selectAll();
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Only autosave once the store's active diagram actually matches the route:
  // avoids writing the stale/blank diagram while hydration or a "new" → real-id
  // redirect is still in flight.
  useEffect(() => {
    if (diagram.id !== diagramId) return;
    const timeout = setTimeout(() => setSaveStatus(saveDiagram(diagram) ? "saved" : "error"), 400);
    return () => clearTimeout(timeout);
  }, [diagram, diagramId]);

  if (missing) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-zinc-50 p-6 text-center dark:bg-zinc-950">
        <h1 className="text-xl font-semibold">Diagram not found</h1>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          This diagram isn&apos;t saved in this browser. Diagrams are stored only on the device that created them,
          so a link or bookmark won&apos;t work on another browser, or after the site data was cleared.
        </p>
        <div className="flex gap-3">
          <Link href="/diagrams" className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            My diagrams
          </Link>
          <Link href="/editor/new" className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700">
            Start a new diagram
          </Link>
        </div>
      </div>
    );
  }

  // The store still holds a placeholder (or the previous diagram) until the saved one has loaded.
  if (diagram.id !== diagramId) {
    return (
      <div role="status" aria-label="Loading diagram" className="flex h-dvh w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900">
        Loading diagram…
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh w-full flex-col bg-zinc-100 dark:bg-zinc-900">
        <Toolbar />
        <SectionTabs />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="relative flex-1">
            <Canvas />
            <button
              type="button"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
              className="absolute bottom-3 right-3 z-10 h-7 w-7 rounded-full border border-zinc-300 bg-white text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              onClick={() => setHelpOpen(true)}
            >
              ?
            </button>
          </div>
          <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <PropertiesPanel />
            <LegendPanel />
          </aside>
        </div>
      </div>
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </ReactFlowProvider>
  );
}
