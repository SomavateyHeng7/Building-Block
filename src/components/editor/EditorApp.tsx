"use client";

import { useEffect, useState } from "react";
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
import { Icon } from "./Icon";
import PanelToggle from "./PanelToggle";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { nextSlotInContainer, nudgeNodes } from "@/lib/diagram/layout";
import { saveDiagramToFile, useFileStore, useIsDirty } from "@/lib/diagram/file";

/** Wait this long after the last edit before writing to the open file. */
const AUTOSAVE_DELAY_MS = 1000;

/** Which side panels are collapsed on wide screens; remembered per browser, like the theme. */
type HiddenPanels = { palette: boolean; properties: boolean };
const PANELS_KEY = "bb:panels";

function readHiddenPanels(): HiddenPanels {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PANELS_KEY) ?? "{}");
    return { palette: saved.palette === true, properties: saved.properties === true };
  } catch {
    return { palette: false, properties: false };
  }
}

const CANVAS_BUTTON =
  "inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/95 px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur aria-expanded:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/95 dark:aria-expanded:bg-zinc-800";
/** What's left of a collapsed panel on wide screens: a strip with the button to open it again. */
const RAIL = "hidden w-10 shrink-0 flex-col items-center bg-white py-2 dark:bg-zinc-950 lg:flex";

export default function EditorApp() {
  const router = useRouter();
  const diagram = useDiagramStore((state) => state.diagram);
  const opened = useFileStore((state) => state.opened);
  const handle = useFileStore((state) => state.handle);
  const saving = useFileStore((state) => state.saving);
  const saveFailed = useFileStore((state) => state.error);
  const dirty = useIsDirty();
  const [helpOpen, setHelpOpen] = useState(false);
  // Below the lg breakpoint the palette and properties panels are drawers over the canvas.
  const [drawer, setDrawer] = useState<"palette" | "properties" | null>(null);
  // On wide screens the panels sit beside the canvas and can be collapsed to give it more room.
  const [hidden, setHidden] = useState<HiddenPanels>(readHiddenPanels);

  function togglePanel(panel: keyof HiddenPanels) {
    setHidden((current) => {
      const next = { ...current, [panel]: !current[panel] };
      try {
        window.localStorage.setItem(PANELS_KEY, JSON.stringify(next));
      } catch {
        // The choice just isn't remembered.
      }
      return next;
    });
  }

  // The diagram lives only in memory, so a fresh load (or a direct link) has nothing to edit yet.
  useEffect(() => {
    if (!opened) router.replace("/diagrams");
  }, [opened, router]);

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
      if (event.key === "Escape") setDrawer(null);
      // Save works from anywhere, including text fields.
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDiagramToFile({ saveAs: event.shiftKey });
        return;
      }
      if (event.defaultPrevented || event.altKey) return;
      const target = event.target as HTMLElement | null;
      // Buttons don't swallow shortcuts (Ctrl+Z right after clicking Undo should work); dialogs and menus do.
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='alertdialog'], [role='menu']")) return;

      const store = useDiagramStore.getState();
      const hasSelection = store.selectedNodeIds.length > 0;

      if (!(event.metaKey || event.ctrlKey)) {
        const section = getActiveSection(store.diagram);
        const nudge = NUDGE[event.key];
        if (nudge && hasSelection) {
          const step = event.shiftKey ? 32 : 8;
          const nodes = nudgeNodes(section.nodes, store.selectedNodeIds, nudge[0] * step, nudge[1] * step);
          store.setActiveSectionNodes(nodes, { coalesceKey: `nudge:${store.selectedNodeIds.join(",")}` });
        } else if (event.key === "Escape") {
          store.setSelection([]);
          store.setSelectedEdge(null);
        }
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

  // With a file to write to, keep it current, like draw.io's autosave to device.
  // Paused after a failed write (the toolbar says "Not saved") until a manual Save succeeds.
  useEffect(() => {
    if (!opened || !handle || !dirty || saving || saveFailed) return;
    const timeout = setTimeout(() => void saveDiagramToFile(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [opened, handle, dirty, diagram, saving, saveFailed]);

  // Closing or reloading the tab would lose whatever isn't in a file yet.
  useEffect(() => {
    if (!dirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  if (!opened) {
    return (
      <div role="status" aria-label="Loading" className="flex h-dvh w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900">
        <Link href="/diagrams" className="underline">
          Go to the start page
        </Link>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh w-full flex-col bg-zinc-100 pb-safe pt-safe px-safe dark:bg-zinc-900">
        <Toolbar onShowShortcuts={() => setHelpOpen(true)} />
        <SectionTabs />
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {drawer && (
            <button
              type="button"
              aria-label="Close panel"
              tabIndex={-1}
              className="absolute inset-0 z-20 min-h-0 cursor-default bg-black/30 lg:hidden"
              onClick={() => setDrawer(null)}
            />
          )}
          {hidden.palette && (
            <div className={`${RAIL} border-r border-zinc-200 dark:border-zinc-800`}>
              <PanelToggle side="left" expanded={false} label="the components panel" onClick={() => togglePanel("palette")} />
            </div>
          )}
          <Sidebar
            onAdded={() => setDrawer(null)}
            onCollapse={() => togglePanel("palette")}
            className={`${drawer === "palette" ? "flex" : "hidden"} absolute inset-y-0 left-0 z-30 w-72 max-w-[85%] shadow-xl lg:static lg:z-auto ${hidden.palette ? "lg:hidden" : "lg:flex"} lg:w-60 lg:shrink-0 lg:shadow-none`}
          />
          <div className="relative min-w-0 flex-1">
            <Canvas />
            <div className="absolute left-3 top-3 z-10 flex gap-2 lg:hidden">
              <button
                type="button"
                aria-expanded={drawer === "palette"}
                className={CANVAS_BUTTON}
                onClick={() => setDrawer(drawer === "palette" ? null : "palette")}
              >
                <Icon name="plus" />
                Add
              </button>
            </div>
            <div className="absolute right-3 top-3 z-10 lg:hidden">
              <button
                type="button"
                aria-expanded={drawer === "properties"}
                className={CANVAS_BUTTON}
                onClick={() => setDrawer(drawer === "properties" ? null : "properties")}
              >
                <Icon name="panel" />
                Details &amp; legend
              </button>
            </div>
          </div>
          <aside
            className={`${drawer === "properties" ? "flex" : "hidden"} absolute inset-y-0 right-0 z-30 w-80 max-w-[85%] flex-col overflow-y-auto border-l border-zinc-200 bg-white pr-safe shadow-xl lg:static lg:z-auto ${hidden.properties ? "lg:hidden" : "lg:flex"} lg:w-72 lg:shrink-0 lg:shadow-none dark:border-zinc-800 dark:bg-zinc-950`}
          >
            <PropertiesPanel
              headerAction={<PanelToggle side="right" expanded label="details and legend" onClick={() => togglePanel("properties")} />}
            />
            <LegendPanel />
          </aside>
          {hidden.properties && (
            <div className={`${RAIL} border-l border-zinc-200 dark:border-zinc-800`}>
              <PanelToggle side="right" expanded={false} label="details and legend" onClick={() => togglePanel("properties")} />
            </div>
          )}
        </div>
      </div>
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </ReactFlowProvider>
  );
}
