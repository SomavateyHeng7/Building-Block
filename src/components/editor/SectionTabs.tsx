"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useDiagramStore } from "@/lib/diagram/store";
import CompareDialog from "./CompareDialog";
import HintsDialog from "./HintsDialog";
import { diagramHints } from "@/lib/diagram/hints";
import { Icon } from "./Icon";
import { useReadOnly } from "./viewMode";

const TAB_ACTION =
  "inline-flex min-h-0 items-center justify-center rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 pointer-coarse:p-2 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export default function SectionTabs() {
  const sections = useDiagramStore((state) => state.diagram.sections);
  const activeSectionId = useDiagramStore((state) => state.diagram.activeSectionId);
  const setActiveSection = useDiagramStore((state) => state.setActiveSection);
  const addSection = useDiagramStore((state) => state.addSection);
  const renameSection = useDiagramStore((state) => state.renameSection);
  const deleteSection = useDiagramStore((state) => state.deleteSection);
  const duplicateSection = useDiagramStore((state) => state.duplicateSection);

  const comments = useDiagramStore((state) => state.diagram.comments);
  const hintCount = useMemo(() => diagramHints({ sections, comments }).length, [sections, comments]);
  const readOnly = useReadOnly();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [checking, setChecking] = useState(false);
  const tablist = useRef<HTMLDivElement>(null);
  // Escape leaves the name as it was; some browsers blur the field as it goes, which must not save.
  const cancelledRename = useRef(false);

  function startRename(id: string) {
    cancelledRename.current = false;
    setEditingId(id);
  }

  function commitRename(id: string, value: string) {
    const name = value.trim();
    if (name && !cancelledRename.current) renameSection(id, name);
    setEditingId(null);
  }

  /** Arrow keys, Home and End move between tabs (the usual tab-list keys); only the open tab is in the Tab order. */
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = sections.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setPendingDeleteId(null);
    setActiveSection(sections[next].id);
    tablist.current?.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus();
  }

  const openTab = sections.find((section) => section.id === activeSectionId);
  const confirming = !!openTab && pendingDeleteId === openTab.id;

  // The tab list holds only the tabs (what a screen reader expects of one); what acts on the open tab, and adding
  // or comparing tabs, sits in a group just after it.
  return (
    <div className="flex items-end gap-0.5 overflow-x-auto overscroll-x-contain border-b border-zinc-200 bg-zinc-50 px-2 pt-1.5 sm:px-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div ref={tablist} role="tablist" aria-label="Diagram tabs" className="flex shrink-0 items-end gap-0.5">
        {sections.map((section, index) => {
          const active = section.id === activeSectionId;
          return (
            <div
              key={section.id}
              className={`relative -mb-px flex h-9 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-t-lg border border-b-0 pl-3 text-sm transition-colors ${
                active
                  ? "border-zinc-200 bg-white pr-3 font-medium text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  : "border-transparent pr-3 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {editingId === section.id ? (
                <input
                  autoFocus
                  aria-label="Tab name"
                  defaultValue={section.name}
                  className="mr-1 w-32 rounded border border-blue-500 bg-transparent px-1.5 py-0.5 text-sm outline-none ring-2 ring-blue-500/20"
                  onBlur={(event) => commitRename(section.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename(section.id, event.currentTarget.value);
                    if (event.key === "Escape") {
                      cancelledRename.current = true;
                      setEditingId(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPendingDeleteId(null);
                    setActiveSection(section.id);
                  }}
                  onDoubleClick={() => !readOnly && startRename(section.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  title={readOnly ? undefined : "Double-click to rename"}
                  className="min-h-0 pr-1"
                >
                  {section.kind === "sequence" && (
                    <Icon name="sequence" className="-mt-0.5 mr-1 inline h-3.5 w-3.5 text-zinc-400" />
                  )}
                  {section.name}
                  {section.kind === "sequence" && <span className="sr-only"> (sequence diagram)</span>}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div role="group" aria-label="Tab actions" className="flex flex-1 items-end gap-0.5">
        {openTab && !readOnly && editingId !== openTab.id && (
          <span className="mb-1 flex h-7 items-center gap-0.5">
            <button
              type="button"
              title="Rename tab"
              aria-label="Rename tab"
              className={TAB_ACTION}
              onClick={() => startRename(openTab.id)}
            >
              <Icon name="pencil" className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Duplicate tab"
              aria-label="Duplicate tab"
              className={TAB_ACTION}
              onClick={() => duplicateSection(openTab.id)}
            >
              <Icon name="copy" className="h-3.5 w-3.5" />
            </button>
            {sections.length > 1 &&
              (confirming ? (
                <button
                  type="button"
                  className="min-h-0 rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white pointer-coarse:px-2.5 pointer-coarse:py-1"
                  onClick={() => {
                    deleteSection(openTab.id);
                    setPendingDeleteId(null);
                  }}
                  onBlur={() => setPendingDeleteId(null)}
                  autoFocus
                >
                  Delete?
                </button>
              ) : (
                <button
                  type="button"
                  title="Delete tab"
                  aria-label="Delete tab"
                  className={`${TAB_ACTION} hover:text-red-600 dark:hover:text-red-400`}
                  onClick={() => setPendingDeleteId(openTab.id)}
                >
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              ))}
          </span>
        )}
        {!readOnly && (
        <button
          type="button"
          title="Add a tab"
          className="mb-1 ml-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          onClick={() => addSection()}
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add tab</span>
          <span className="sr-only sm:hidden">Add tab</span>
        </button>
        )}
        {!readOnly && (
          <button
            type="button"
            title="Add a sequence diagram tab, to show a flow step by step"
            aria-label="Add a sequence tab"
            className="mb-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={() => addSection(undefined, "sequence")}
          >
            <Icon name="sequence" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sequence</span>
          </button>
        )}
        {sections.some((section) => section.kind !== "sequence") && (
          <button
            type="button"
            title="Check for components with no connections or owner, and connections with no protocol"
            className="mb-1 ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={() => setChecking(true)}
          >
            <Icon name="check" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Check</span>
            <span className="sr-only sm:hidden">Check</span>
            {hintCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {hintCount}
                <span className="sr-only"> to look at</span>
              </span>
            )}
          </button>
        )}
        {sections.filter((section) => section.kind !== "sequence").length > 1 && (
          <button
            type="button"
            title="Compare two tabs: what is added, removed and changed"
            className="mb-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={() => setComparing(true)}
          >
            <Icon name="swap" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Compare tabs</span>
            <span className="sr-only sm:hidden">Compare tabs</span>
          </button>
        )}
      </div>
      {/* Portalled: a dialog doesn't belong inside the tab bar. */}
      {checking && createPortal(<HintsDialog onClose={() => setChecking(false)} />, document.body)}
      {comparing && createPortal(<CompareDialog onClose={() => setComparing(false)} />, document.body)}
    </div>
  );
}
