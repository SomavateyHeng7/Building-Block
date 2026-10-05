"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import Canvas from "./Canvas";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar";
import PropertiesPanel from "./PropertiesPanel";
import LegendPanel from "./LegendPanel";
import SectionTabs from "./SectionTabs";
import { useDiagramStore } from "@/lib/diagram/store";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { loadDiagramFromStorage, saveDiagram } from "@/lib/diagram/persistence";

interface EditorAppProps {
  diagramId: string;
}

export default function EditorApp({ diagramId }: EditorAppProps) {
  const router = useRouter();
  const diagram = useDiagramStore((state) => state.diagram);
  const loadDiagram = useDiagramStore((state) => state.loadDiagram);
  const hydratedForId = useRef<string | null>(null);

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
    saveDiagram(blank);
    router.replace(`/editor/${blank.id}`);
  }, [diagramId, loadDiagram, router]);

  // Editing shortcuts. Text fields keep their native behaviour (text undo, copy/paste, select all).
  // Delete/Backspace is handled by React Flow on the canvas.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      const store = useDiagramStore.getState();
      const key = event.key.toLowerCase();
      const hasSelection = store.selectedNodeIds.length > 0;
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
    const timeout = setTimeout(() => saveDiagram(diagram), 400);
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
          </div>
          <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <PropertiesPanel />
            <LegendPanel />
          </aside>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
