"use client";

import { useMemo, useRef, useState } from "react";
import { everyNode, useDiagramStore } from "@/lib/diagram/store";
import { Icon } from "./Icon";
import ColorPicker from "./ColorPicker";

export default function LegendPanel() {
  const legend = useDiagramStore((state) => state.diagram.legend);
  const diagram = useDiagramStore((state) => state.diagram);
  const updateLegendEntry = useDiagramStore((state) => state.updateLegendEntry);
  const addLegendEntry = useDiagramStore((state) => state.addLegendEntry);
  const removeLegendEntry = useDiagramStore((state) => state.removeLegendEntry);
  const moveLegendEntry = useDiagramStore((state) => state.moveLegendEntry);

  // The entry whose name is being edited: a new one, or one double-clicked.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // An in-use category being removed, and where its items go ("" leaves them unassigned).
  const [removing, setRemoving] = useState<{ key: string; into: string } | null>(null);
  // A row being dragged by its handle: where it was, and the gap (0…length) it would drop into.
  const [drag, setDrag] = useState<{ key: string; from: number; slot: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Escape leaves the name as it was; the blur that follows must not save what was typed.
  const cancelled = useRef(false);

  function startEditing(key: string) {
    cancelled.current = false;
    setEditingKey(key);
  }

  // How many items use each entry, across all tabs, internal designs and sequence participants.
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    const keys = [
      ...everyNode(diagram).map((node) => node.data.colorKey),
      ...diagram.sections.flatMap((section) => section.sequence?.participants.map((participant) => participant.colorKey) ?? []),
    ];
    for (const key of keys) if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, [diagram]);

  /** Lower-case colour → the categories using it, so the picker can point out repeats. */
  function usedByOthers(key: string): Map<string, string[]> {
    const users = new Map<string, string[]>();
    for (const entry of legend) {
      if (entry.key === key) continue;
      const color = entry.color.toLowerCase();
      users.set(color, [...(users.get(color) ?? []), entry.label || "an unnamed category"]);
    }
    return users;
  }

  function handleRemove(key: string) {
    if ((usage.get(key) ?? 0) > 0) setRemoving({ key, into: "" });
    else removeLegendEntry(key);
  }

  /** The gap the pointer is nearest: rows whose middle is above it come before. */
  function slotAt(clientY: number) {
    const rows = [...(listRef.current?.querySelectorAll("[data-legend-row]") ?? [])];
    return rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top + rect.height / 2 < clientY;
    }).length;
  }

  /** Moves an entry and keeps keyboard focus on its handle (moving the row in the page can drop it). */
  function move(key: string, index: number) {
    moveLegendEntry(key, index);
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLElement>(`[data-legend-handle="${CSS.escape(key)}"]`)?.focus(),
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Legend</h2>
        <button
          type="button"
          title="Add legend entry"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          onClick={() => startEditing(addLegendEntry())}
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
      {legend.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-xs leading-snug text-zinc-500 dark:border-zinc-700">
          No legend entries. Add one to color-code your components.
        </p>
      )}
      <div ref={listRef} className="-mx-1 flex flex-col">
        {legend.map((entry, index) => {
          const count = usage.get(entry.key) ?? 0;
          const confirming = removing?.key === entry.key;
          const dropBefore = drag && drag.slot === index && drag.slot !== drag.from && drag.slot !== drag.from + 1;
          const dropAfter = drag && index === legend.length - 1 && drag.slot === legend.length && drag.from !== index;
          return (
            <div key={entry.key} data-legend-row className="flex flex-col">
              <div
                className={`group flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                  drag?.key === entry.key ? "bg-zinc-100 opacity-60 dark:bg-zinc-800" : ""
                } ${dropBefore ? "shadow-[inset_0_2px_0_#3b82f6]" : ""} ${dropAfter ? "shadow-[inset_0_-2px_0_#3b82f6]" : ""}`}
              >
                <button
                  type="button"
                  data-legend-handle={entry.key}
                  aria-label={`Move ${entry.label}. Use the up and down arrow keys`}
                  title="Drag to reorder"
                  className={`inline-flex shrink-0 cursor-grab touch-none rounded p-0.5 text-zinc-400 opacity-0 hover:bg-zinc-100 hover:text-zinc-700 focus:opacity-100 active:cursor-grabbing group-hover:opacity-100 pointer-coarse:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${
                    legend.length < 2 ? "invisible" : ""
                  }`}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDrag({ key: entry.key, from: index, slot: index });
                  }}
                  onPointerMove={(event) => {
                    if (drag?.key === entry.key) setDrag({ ...drag, slot: slotAt(event.clientY) });
                  }}
                  onPointerUp={() => {
                    if (drag?.key !== entry.key) return;
                    // A gap below the row's old place counts it once less, as it leaves from above.
                    const to = drag.slot > drag.from ? drag.slot - 1 : drag.slot;
                    setDrag(null);
                    if (to !== drag.from) moveLegendEntry(entry.key, to);
                  }}
                  onPointerCancel={() => setDrag(null)}
                  onKeyDown={(event) => {
                    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
                    if (!step) return;
                    event.preventDefault();
                    move(entry.key, index + step);
                  }}
                >
                  <Icon name="grip" className="h-3.5 w-3.5" />
                </button>
                <ColorPicker
                  label={`Colour for ${entry.label || "unnamed category"}`}
                  value={entry.color}
                  usedBy={usedByOthers(entry.key)}
                  onChange={(color) => updateLegendEntry(entry.key, { color })}
                />
                {editingKey === entry.key ? (
                  <input
                    autoFocus
                    onFocus={(event) => event.target.select()}
                    aria-label="Legend entry name"
                    defaultValue={entry.label}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        cancelled.current = true;
                        event.currentTarget.blur();
                      }
                    }}
                    // A blank name would leave the legend and the palette with an unlabelled colour.
                    onBlur={(event) => {
                      const label = event.target.value.trim() ? event.target.value : "Untitled category";
                      if (!cancelled.current && label !== entry.label) updateLegendEntry(entry.key, { label });
                      cancelled.current = false;
                      setEditingKey(null);
                    }}
                    className="w-full min-w-0 rounded border border-blue-500 bg-white px-1.5 py-1 text-sm outline-none ring-2 ring-blue-500/20 dark:bg-zinc-900"
                  />
                ) : (
                  <span
                    tabIndex={0}
                    role="button"
                    aria-label={`${entry.label}. Double-click or press Enter to rename`}
                    title="Double-click to rename"
                    onDoubleClick={() => startEditing(entry.key)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === "F2") {
                        event.preventDefault();
                        startEditing(entry.key);
                      }
                    }}
                    className="w-full min-w-0 cursor-default select-none truncate rounded border border-transparent px-1.5 py-1 text-sm outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20"
                  >
                    {entry.label}
                  </span>
                )}
                {count > 0 && !confirming && (
                  <span
                    title={`Used by ${count} item${count === 1 ? "" : "s"}`}
                    className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[10px] font-medium tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {count}
                  </span>
                )}
                {!confirming && (
                  <button
                    type="button"
                    title="Remove legend entry"
                    aria-label={`Remove ${entry.label}`}
                    className="inline-flex shrink-0 rounded p-1 text-zinc-400 opacity-0 hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 dark:hover:bg-red-950"
                    onClick={() => handleRemove(entry.key)}
                  >
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {confirming && removing && (
                <div
                  role="group"
                  aria-label={`Remove ${entry.label}`}
                  className="mx-1 mb-1 flex flex-col gap-2 rounded-md border border-red-200 bg-red-50/60 p-2 text-xs text-zinc-700 dark:border-red-900 dark:bg-red-950/40 dark:text-zinc-200"
                  // Esc closes only this box, not the drawer or the selection (see EditorApp).
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.stopPropagation();
                    setRemoving(null);
                  }}
                >
                  <p>
                    {count} item{count === 1 ? " uses" : "s use"} &ldquo;{entry.label}&rdquo;. Before removing it:
                  </p>
                  <label className="flex flex-col gap-1 font-medium">
                    Move {count === 1 ? "it" : "them"} to
                    <select
                      autoFocus
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                      value={removing.into}
                      onChange={(event) => setRemoving({ ...removing, into: event.target.value })}
                    >
                      <option value="">No category (unassigned)</option>
                      {legend
                        .filter((other) => other.key !== entry.key)
                        .map((other) => (
                          <option key={other.key} value={other.key}>
                            {other.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      className="rounded border border-zinc-300 bg-white px-2 py-0.5 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      onClick={() => setRemoving(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded bg-red-600 px-2 py-0.5 font-medium text-white hover:bg-red-700"
                      onClick={() => {
                        removeLegendEntry(entry.key, removing.into || undefined);
                        setRemoving(null);
                      }}
                    >
                      {removing.into ? "Move and remove" : "Remove"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
