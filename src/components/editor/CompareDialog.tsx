"use client";

import { useEffect, useMemo, useState } from "react";
import { useDiagramStore } from "@/lib/diagram/store";
import {
  compareSections,
  comparisonRows,
  connectionName,
  countChanges,
  type ChangeKind,
  type ConnectionChange,
  type FieldChange,
  type NodeChange,
} from "@/lib/diagram/compare";
import { toCsv } from "@/lib/diagram/export";
import { downloadBlob, fileBaseName } from "@/lib/diagram/file";
import { toast } from "@/lib/toast";
import { goTo } from "./canvasFocus";
import { useCompareView } from "./compareView";
import { Icon } from "./Icon";

const SECTION_HEADING = "text-xs font-semibold uppercase tracking-wide text-zinc-500";
const FIELD =
  "min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900";

const BADGE: Record<ChangeKind, { label: string; className: string }> = {
  added: { label: "Added", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  removed: { label: "Removed", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  changed: { label: "Changed", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
};
const ORDER: ChangeKind[] = ["added", "removed", "changed"];

/**
 * Compares two tabs (e.g. current and target state) and lists what is added, removed and changed. Picking
 * an item opens the tab it is on with it selected; the list downloads as a CSV for the solution document.
 */
export default function CompareDialog({ onClose }: { onClose: () => void }) {
  const diagram = useDiagramStore((state) => state.diagram);
  const setActiveSection = useDiagramStore((state) => state.setActiveSection);
  const showCompare = useCompareView((state) => state.show);
  const { activeSectionId } = diagram;
  // Comparing is about boxes and connections, so sequence tabs aren't offered.
  const sections = useMemo(() => diagram.sections.filter((section) => section.kind !== "sequence"), [diagram.sections]);

  // Tabs usually run from "current" to "target": compare the tab on screen with the one before it, or, on
  // the first tab, with the one after it.
  const [initialFrom, initialTo] = (() => {
    const index = Math.max(0, sections.findIndex((section) => section.id === activeSectionId));
    return index > 0 ? [sections[index - 1], sections[index]] : [sections[0], sections[1] ?? sections[0]];
  })();
  const [fromId, setFromId] = useState(initialFrom.id);
  const [toId, setToId] = useState(initialTo.id);
  const from = sections.find((section) => section.id === fromId);
  const to = sections.find((section) => section.id === toId);

  const comparison = useMemo(
    () => (from && to && from !== to ? compareSections(diagram, from, to) : null),
    [diagram, from, to],
  );
  const counts = comparison ? countChanges(comparison) : null;
  const total = counts ? counts.added + counts.removed + counts.changed : 0;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function show(change: NodeChange | ConnectionChange, kind: "node" | "connection") {
    goTo({ sectionId: change.sectionId, kind: kind === "node" ? "node" : "edge", id: change.id });
    onClose();
  }

  /** Marks the differences on both tabs and opens the "to" tab, where additions and changes are. */
  function showOnCanvas() {
    if (!from || !to) return;
    showCompare({ diagramId: diagram.id, fromId: from.id, toId: to.id });
    setActiveSection(to.id);
    onClose();
  }

  function download() {
    if (!comparison || !from || !to) return;
    const name = `${fileBaseName(diagram.name)}-${fileBaseName(from.name)}-vs-${fileBaseName(to.name)}.csv`;
    downloadBlob(new Blob([toCsv(comparisonRows(comparison))], { type: "text/csv;charset=utf-8" }), name);
    toast.success(`Downloaded ${name}`);
  }

  const byKind = <T extends { kind: ChangeKind }>(list: T[]) =>
    [...list].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        className="flex max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 id="compare-title" className="text-base font-semibold">
            Compare tabs
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              From
              <select autoFocus className={FIELD} value={fromId} onChange={(event) => setFromId(event.target.value)}>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              title="Swap"
              aria-label="Swap the tabs"
              className="flex h-[34px] w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={() => {
                setFromId(toId);
                setToId(fromId);
              }}
            >
              <Icon name="swap" />
            </button>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              To
              <select className={FIELD} value={toId} onChange={(event) => setToId(event.target.value)}>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!comparison || !counts ? (
            <p className="text-sm text-zinc-500">Choose two different tabs.</p>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
                {total === 0 ? (
                  <>No differences: the tabs have the same components, containers and connections.</>
                ) : (
                  <>
                    {ORDER.filter((kind) => counts[kind]).map((kind, index) => (
                      <span key={kind}>
                        {index > 0 && " · "}
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{counts[kind]}</span>{" "}
                        {kind}
                      </span>
                    ))}
                    {comparison.unchanged > 0 && ` · ${comparison.unchanged} unchanged`}
                  </>
                )}
              </p>

              {comparison.nodes.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className={SECTION_HEADING}>Components and containers</h3>
                  <ul className="flex flex-col gap-1">
                    {byKind(comparison.nodes).map((change) => (
                      <ChangeItem
                        key={`${change.kind}:${change.id}`}
                        kind={change.kind}
                        name={change.label}
                        detail={change.type === "container" ? "Container" : undefined}
                        fields={change.fields}
                        onShow={() => show(change, "node")}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {comparison.connections.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className={SECTION_HEADING}>Connections</h3>
                  <ul className="flex flex-col gap-1">
                    {byKind(comparison.connections).map((change) => (
                      <ChangeItem
                        key={`${change.kind}:${change.id}`}
                        kind={change.kind}
                        name={connectionName(change)}
                        fields={change.fields}
                        onShow={() => show(change, "connection")}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-200 bg-zinc-50 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-950/40">
          <p className="text-xs text-zinc-500">
            Matched by name. Moving or resizing isn&apos;t counted as a change. Pick an item to see it on its tab.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              disabled={!total}
              title="Outline what changed on both tabs; exports include the marks while they're shown"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={showOnCanvas}
            >
              <Icon name="eye" />
              Show on canvas
            </button>
            <button
              type="button"
              disabled={!total}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              onClick={download}
            >
              <Icon name="download" />
              Download change list (CSV)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChangeItem({
  kind,
  name,
  detail,
  fields,
  onShow,
}: {
  kind: ChangeKind;
  name: string;
  detail?: string;
  fields: FieldChange[];
  onShow: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
        onClick={onShow}
      >
        <span className="flex items-center gap-2 text-sm">
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${BADGE[kind].className}`}>
            {BADGE[kind].label}
          </span>
          <span className="min-w-0 truncate font-medium">{name}</span>
          {detail && <span className="shrink-0 text-xs text-zinc-500">{detail}</span>}
        </span>
        {fields.length > 0 && (
          <span className="flex flex-col gap-0.5 pl-1 text-xs text-zinc-600 dark:text-zinc-400">
            {fields.map((field) => (
              <span key={field.field} className="break-words">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{field.field}:</span>{" "}
                {field.before || "—"} → {field.after || "—"}
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
}
