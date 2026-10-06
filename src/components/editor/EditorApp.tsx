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
  downloadDiagramJson,
  getDiagramIndexServerSnapshot,
  getDiagramIndexSnapshot,
  loadDiagramFromStorage,
  saveDiagram,
  subscribeDiagramIndex,
  subscribeToOtherTabs,
} from "@/lib/diagram/persistence";
import { getLastBackup, needsBackupNudge, requestPersistentStorage } from "@/lib/diagram/backup";
import type { Diagram } from "@/lib/diagram/types";
import { toast } from "@/lib/toast";
import { useMounted } from "@/components/theme-toggle";
import { setSaveStatus } from "@/lib/diagram/saveStatus";

/** Another tab changed or deleted this diagram while this tab had unsaved edits. */
type TabConflict = "changed" | "deleted";

interface EditorAppProps {
  diagramId: string;
}

export default function EditorApp({ diagramId }: EditorAppProps) {
  const router = useRouter();
  const diagram = useDiagramStore((state) => state.diagram);
  const loadDiagram = useDiagramStore((state) => state.loadDiagram);
  const hydratedForId = useRef<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [conflict, setConflict] = useState<TabConflict | null>(null);
  // updatedAt of the version this tab last loaded from or wrote to storage; anything else is unsaved here.
  const syncedAt = useRef<string | null>(null);
  const nudgedFor = useRef<string | null>(null);
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
      const current = useDiagramStore.getState().diagram;
      if (current.id === diagramId) {
        syncedAt.current = loadDiagramFromStorage(diagramId)?.updatedAt ?? null;
        return;
      }
      const existing = loadDiagramFromStorage(diagramId);
      if (existing) {
        loadDiagram(existing);
        syncedAt.current = existing.updatedAt;
        setSaveStatus("saved");
      }
      return;
    }

    const blank = createBlankDiagram();
    loadDiagram(blank);
    const saved = saveDiagram(blank);
    if (saved) syncedAt.current = blank.updatedAt;
    setSaveStatus(saved ? "saved" : "error");
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
  // Paused during a tab conflict so neither tab's version silently overwrites the other.
  useEffect(() => {
    if (diagram.id !== diagramId || conflict || diagram.updatedAt === syncedAt.current) return;
    const timeout = setTimeout(() => {
      const saved = saveDiagram(diagram);
      if (saved) {
        syncedAt.current = diagram.updatedAt;
        void requestPersistentStorage();
      }
      setSaveStatus(saved ? "saved" : "error");
    }, 400);
    return () => clearTimeout(timeout);
  }, [diagram, diagramId, conflict]);

  // The same diagram open in another tab: follow its edits while this tab has none of its own.
  useEffect(() => {
    if (conflict) return;
    return subscribeToOtherTabs(diagramId, (stored) => {
      const current = useDiagramStore.getState().diagram;
      if (current.id !== diagramId || stored?.updatedAt === current.updatedAt) return;
      if (stored && current.updatedAt === syncedAt.current) {
        loadDiagram(stored);
        syncedAt.current = stored.updatedAt;
        return;
      }
      setConflict(stored ? "changed" : "deleted");
    });
  }, [diagramId, conflict, loadDiagram]);

  // Once per opened diagram: suggest a JSON backup when a week of work is only in this browser.
  useEffect(() => {
    if (diagram.id !== diagramId || nudgedFor.current === diagramId) return;
    nudgedFor.current = diagramId;
    if (!needsBackupNudge(diagram, getLastBackup(diagram.id))) return;
    toast.info("Back up this diagram", {
      details: [
        "It's stored only in this browser. Clearing site data, or 7 days without visiting in Safari, deletes it.",
        "A JSON backup can be re-imported any time.",
      ],
      action: { label: "Download JSON backup", onClick: () => downloadDiagramJson(useDiagramStore.getState().diagram) },
      duration: 0,
    });
  }, [diagram, diagramId]);

  function loadOtherTabVersion() {
    const latest = loadDiagramFromStorage(diagramId);
    if (latest) {
      loadDiagram(latest);
      syncedAt.current = latest.updatedAt;
    }
    setConflict(null);
  }

  function keepThisVersion() {
    // Forces the autosave to write this tab's version even if it has no edits since loading.
    syncedAt.current = null;
    setConflict(null);
  }

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
        {conflict && (
          <TabConflictBanner
            conflict={conflict}
            diagram={diagram}
            onLoadOther={loadOtherTabVersion}
            onKeepThis={keepThisVersion}
            onLeave={() => router.push("/diagrams")}
          />
        )}
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

function TabConflictBanner({
  conflict,
  diagram,
  onLoadOther,
  onKeepThis,
  onLeave,
}: {
  conflict: TabConflict;
  diagram: Diagram;
  onLoadOther: () => void;
  onKeepThis: () => void;
  onLeave: () => void;
}) {
  const button =
    "rounded border border-amber-400 bg-white px-2.5 py-1 text-xs font-medium hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:hover:bg-amber-900";
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100"
    >
      <p className="min-w-0 flex-1">
        {conflict === "changed"
          ? "This diagram was changed in another tab. Saving is paused here so neither version overwrites the other."
          : "This diagram was deleted in another tab. Your edits here aren't saved."}
      </p>
      <div className="flex flex-wrap gap-2">
        {conflict === "changed" ? (
          <>
            <button type="button" className={button} onClick={onLoadOther}>
              Use the other tab&apos;s version
            </button>
            <button type="button" className={button} onClick={onKeepThis}>
              Keep this version
            </button>
          </>
        ) : (
          <>
            <button type="button" className={button} onClick={onKeepThis}>
              Keep it
            </button>
            <button type="button" className={button} onClick={onLeave}>
              Close
            </button>
          </>
        )}
        <button type="button" className={button} onClick={() => downloadDiagramJson(diagram)}>
          Download this version (JSON)
        </button>
      </div>
    </div>
  );
}
