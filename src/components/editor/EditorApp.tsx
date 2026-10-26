"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import Canvas from "./Canvas";
import SequenceCanvas from "./SequenceCanvas";
import SequenceCode, { useSequenceCode } from "./SequenceCode";
import { findSequenceItem, selectSequenceItem, useSequenceSelection } from "./sequenceSelection";
import { moveParticipant, moveStep, removeParticipant, removeStep } from "@/lib/diagram/sequence";
import { isSequenceSection } from "@/lib/diagram/factory";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar";
import PropertiesPanel from "./PropertiesPanel";
import LegendPanel from "./LegendPanel";
import SectionTabs from "./SectionTabs";
import DetailBar from "./DetailBar";
import CompareBar from "./CompareBar";
import SearchDialog from "./SearchDialog";
import ShortcutsHelp from "./ShortcutsHelp";
import DeleteContainerDialog from "./DeleteContainerDialog";
import { ungroup } from "./deletePrompt";
import { useDetailsRequest } from "./detailsPanel";
import { Icon } from "./Icon";
import PanelToggle from "./PanelToggle";
import ViewSheet from "./ViewSheet";
import { ReadOnlyContext, useMediaQuery } from "./viewMode";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { nextSlotInContainer, nudgeNodes } from "@/lib/diagram/layout";
import { saveDiagramToFile, useFileStore, useIsDirty } from "@/lib/diagram/file";
import { clearRecoveryCopy, useRecoveryEnabled, writeRecoveryCopy } from "@/lib/diagram/recovery";
import { toast } from "@/lib/toast";

/** Wait this long after the last edit before writing to the open file. */
const AUTOSAVE_DELAY_MS = 1000;
/** Wait this long after the last edit before updating the recovery copy (when it's turned on). */
const RECOVERY_DELAY_MS = 500;

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
  const sequenceTab = isSequenceSection(getActiveSection(diagram));
  const codeOpen = useSequenceCode((state) => state.open);
  const setCodeOpen = useSequenceCode((state) => state.setOpen);
  const opened = useFileStore((state) => state.opened);
  const handle = useFileStore((state) => state.handle);
  const saving = useFileStore((state) => state.saving);
  const saveFailed = useFileStore((state) => state.error);
  const dirty = useIsDirty();
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Below the lg breakpoint the palette and properties panels are drawers over the canvas.
  const [drawer, setDrawer] = useState<"palette" | "properties" | null>(null);
  // On wide screens the panels sit beside the canvas and can be collapsed to give it more room.
  const [hidden, setHidden] = useState<HiddenPanels>(readHiddenPanels);
  // Phones open in view mode (reading a diagram); anyone can switch. Wide screens always edit.
  const phone = useMediaQuery("(max-width: 767px)", false);
  const wide = useMediaQuery("(min-width: 1024px)", true);
  const [mode, setMode] = useState<"view" | "edit" | null>(null);
  const readOnly = !wide && (mode ?? (phone ? "view" : "edit")) === "view";
  const [legendOpen, setLegendOpen] = useState(false);
  // The keyboard handler is set up once, so it reads the mode from here.
  const readOnlyRef = useRef(readOnly);
  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  function switchMode(next: "view" | "edit") {
    setMode(next);
    setDrawer(null);
    setLegendOpen(false);
  }

  /** Collapses or expands a panel on wide screens; without `hide`, toggles it. */
  function togglePanel(panel: keyof HiddenPanels, hide?: boolean) {
    setHidden((current) => {
      if (current[panel] === hide) return current;
      const next = { ...current, [panel]: !current[panel] };
      try {
        window.localStorage.setItem(PANELS_KEY, JSON.stringify(next));
      } catch {
        // The choice just isn't remembered.
      }
      return next;
    });
  }

  // Something on the canvas (the note badge) asked for the details panel: open its drawer or expand it,
  // then focus the field it named once the panel has rendered.
  const wideRef = useRef(wide);
  useEffect(() => {
    wideRef.current = wide;
  }, [wide]);
  useEffect(
    () =>
      useDetailsRequest.subscribe(({ request }) => {
        if (!request) return;
        useDetailsRequest.setState({ request: null });
        if (wideRef.current) togglePanel("properties", false);
        else setDrawer("properties");
        if (request.focusId) {
          const id = request.focusId;
          requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(id)?.focus()));
        }
      }),
    [],
  );

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
      // After that check, so Esc while typing in a drawer (say, cancelling a rename) leaves the drawer open.
      if (event.key === "Escape") setDrawer(null);

      // Finding things is reading, so it works in view mode too.
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }

      // View mode only looks: Esc still clears the selection and leaves an internal design.
      if (readOnlyRef.current && event.key !== "Escape") return;

      const store = useDiagramStore.getState();
      const hasSelection = store.selectedNodeIds.length > 0;

      // A sequence tab has its own selection: arrows move it along, Delete removes it, Esc clears it.
      const sequence = getActiveSection(store.diagram).sequence;
      const item = findSequenceItem(sequence, useSequenceSelection.getState().id);
      if (item && !(event.metaKey || event.ctrlKey)) {
        const id = item.kind === "participant" ? item.participant.id : item.step.id;
        const [back, forward] = item.kind === "participant" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
        if (event.key === "Escape") selectSequenceItem(null);
        else if (readOnlyRef.current) return;
        else if (event.key === back || event.key === forward) {
          const to = item.index + (event.key === back ? -1 : 1);
          store.updateSequence((current) => (item.kind === "participant" ? moveParticipant(current, id, to) : moveStep(current, id, to)));
        } else if (event.key === "Delete" || event.key === "Backspace") {
          store.updateSequence((current) => (item.kind === "participant" ? removeParticipant(current, id) : removeStep(current, id)));
          selectSequenceItem(null);
        } else return;
        event.preventDefault();
        return;
      }

      if (!(event.metaKey || event.ctrlKey)) {
        const section = getActiveSection(store.diagram);
        const nudge = NUDGE[event.key];
        if (nudge && hasSelection) {
          const step = event.shiftKey ? 32 : 8;
          const nodes = nudgeNodes(section.nodes, store.selectedNodeIds, nudge[0] * step, nudge[1] * step);
          store.setActiveSectionNodes(nodes, { coalesceKey: `nudge:${store.selectedNodeIds.join(",")}` });
        } else if (event.key === "Escape") {
          // Esc clears the selection first; with nothing selected it goes back up from an internal design.
          if (!hasSelection && !store.selectedEdgeId && section.parent) store.closeDetail();
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
        // The copy includes a container's components, so they go with it.
        store.copySelection();
        store.deleteNodes(store.selectedNodeIds, { withContents: true });
      } else if (key === "g" && hasSelection) {
        if (event.shiftKey) ungroup(store.selectedNodeIds);
        else if (!store.groupNodes(store.selectedNodeIds)) toast.info("Select one or more components to group");
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

  // With recovery copies on, unsaved changes are kept in the browser until saved; a clean diagram needs none.
  const recoveryOn = useRecoveryEnabled();
  useEffect(() => {
    if (!opened || !recoveryOn) return;
    if (!dirty) {
      clearRecoveryCopy(diagram.id);
      return;
    }
    const timeout = setTimeout(() => {
      if (!writeRecoveryCopy(diagram, useFileStore.getState().fileName)) {
        toast.warning("Couldn't keep a recovery copy", {
          description: "The browser's storage is full or blocked. Save to a file to keep your changes.",
        });
      }
    }, RECOVERY_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [opened, recoveryOn, dirty, diagram]);

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
      <ReadOnlyContext.Provider value={readOnly}>
      <div className="flex h-dvh w-full flex-col bg-zinc-100 pb-safe pt-safe px-safe dark:bg-zinc-900">
        <Toolbar onShowShortcuts={() => setHelpOpen(true)} onSearch={() => setSearchOpen(true)} />
        <SectionTabs />
        <DetailBar />
        <CompareBar />
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
          <div className={`relative min-w-0 flex-1 ${readOnly ? "bb-readonly" : ""}`}>
            {sequenceTab ? (
              // The Mermaid code sits beside the sheet on wide screens and under it on narrow ones.
              <div className="flex h-full flex-col lg:flex-row">
                <div className="relative min-h-0 min-w-0 flex-1">
                  <SequenceCanvas />
                  {!codeOpen && (
                    // Narrow screens have it with the buttons along the top (below).
                    <button type="button" className={`${CANVAS_BUTTON} absolute right-3 top-3 z-10 max-lg:hidden`} onClick={() => setCodeOpen(true)}>
                      <Icon name="code" />
                      Mermaid code
                    </button>
                  )}
                </div>
                {codeOpen && <SequenceCode />}
              </div>
            ) : (
              <Canvas />
            )}
            <div className="absolute left-3 top-3 z-10 flex gap-2 lg:hidden">
              {readOnly ? (
                <button type="button" className={CANVAS_BUTTON} onClick={() => switchMode("edit")}>
                  <Icon name="pencil" />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    aria-expanded={drawer === "palette"}
                    className={CANVAS_BUTTON}
                    onClick={() => setDrawer(drawer === "palette" ? null : "palette")}
                  >
                    <Icon name="plus" />
                    Add
                  </button>
                  <button type="button" title="View only: look around without moving anything" className={CANVAS_BUTTON} onClick={() => switchMode("view")}>
                    <Icon name="eye" />
                    <span className="sr-only sm:not-sr-only">View</span>
                  </button>
                </>
              )}
            </div>
            <div className="absolute right-3 top-3 z-10 flex gap-2 lg:hidden">
              {sequenceTab && !codeOpen && (
                <button type="button" title="Mermaid code" className={CANVAS_BUTTON} onClick={() => setCodeOpen(true)}>
                  <Icon name="code" />
                  <span className="sr-only">Mermaid code</span>
                </button>
              )}
              {readOnly ? (
                <button type="button" aria-expanded={legendOpen} className={CANVAS_BUTTON} onClick={() => setLegendOpen((open) => !open)}>
                  <Icon name="layers" />
                  Legend
                </button>
              ) : (
                <button
                  type="button"
                  aria-expanded={drawer === "properties"}
                  className={CANVAS_BUTTON}
                  onClick={() => setDrawer(drawer === "properties" ? null : "properties")}
                >
                  <Icon name="panel" />
                  <span className="hidden min-[380px]:inline">Details &amp; legend</span>
                  <span className="min-[380px]:hidden">Details</span>
                </button>
              )}
            </div>
            {readOnly && <ViewSheet legendOpen={legendOpen} onCloseLegend={() => setLegendOpen(false)} />}
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
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
      <DeleteContainerDialog />
      </ReadOnlyContext.Provider>
    </ReactFlowProvider>
  );
}
