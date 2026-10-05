"use client";

import { useEffect, useRef, useState } from "react";
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
import { loadDiagramFromStorage, saveDiagram } from "@/lib/diagram/persistence";
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

  useEffect(() => {
    if (hydratedForId.current === diagramId) return;
    hydratedForId.current = diagramId;

    if (diagramId !== "new") {
      const existing = loadDiagramFromStorage(diagramId);
      if (existing) {
        loadDiagram(existing);
        return;
      }
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
