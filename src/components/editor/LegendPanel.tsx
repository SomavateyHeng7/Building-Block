"use client";

import { useMemo, useState } from "react";
import { useDiagramStore } from "@/lib/diagram/store";

export default function LegendPanel() {
  const legend = useDiagramStore((state) => state.diagram.legend);
  const sections = useDiagramStore((state) => state.diagram.sections);
  const updateLegendEntry = useDiagramStore((state) => state.updateLegendEntry);
  const addLegendEntry = useDiagramStore((state) => state.addLegendEntry);
  const removeLegendEntry = useDiagramStore((state) => state.removeLegendEntry);

  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [pendingRemoveKey, setPendingRemoveKey] = useState<string | null>(null);

  // How many nodes use each entry, across all sections.
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const section of sections) {
      for (const node of section.nodes) {
        const key = node.data.colorKey;
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [sections]);

  function handleRemove(key: string) {
    if ((usage.get(key) ?? 0) > 0 && pendingRemoveKey !== key) {
      setPendingRemoveKey(key);
      return;
    }
    removeLegendEntry(key);
    setPendingRemoveKey(null);
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Legend</h2>
        <button
          type="button"
          title="Add legend entry"
          className="rounded px-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          onClick={() => setFocusKey(addLegendEntry())}
        >
          + Add
        </button>
      </div>
      {legend.length === 0 && (
        <p className="text-[11px] leading-snug text-zinc-400">
          No legend entries. Add one to color-code your components.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {legend.map((entry) => {
          const count = usage.get(entry.key) ?? 0;
          const confirming = pendingRemoveKey === entry.key;
          return (
            <div key={entry.key} className="group flex items-center gap-2">
              <input
                type="color"
                value={entry.color}
                onChange={(event) => updateLegendEntry(entry.key, { color: event.target.value })}
                className="h-6 w-6 shrink-0 cursor-pointer rounded border border-zinc-300 bg-transparent p-0 dark:border-zinc-700"
              />
              <input
                autoFocus={entry.key === focusKey}
                onFocus={(event) => entry.key === focusKey && event.target.select()}
                value={entry.label}
                onChange={(event) => updateLegendEntry(entry.key, { label: event.target.value })}
                className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs outline-none hover:border-zinc-300 focus:border-zinc-500 dark:hover:border-zinc-700"
              />
              {count > 0 && !confirming && (
                <span
                  title={`Used by ${count} item${count === 1 ? "" : "s"}`}
                  className="shrink-0 text-[10px] tabular-nums text-zinc-400"
                >
                  {count}
                </span>
              )}
              {confirming ? (
                <button
                  type="button"
                  autoFocus
                  title={`${count} item${count === 1 ? "" : "s"} will become unassigned`}
                  className="shrink-0 rounded bg-red-600 px-1.5 text-[11px] text-white"
                  onClick={() => handleRemove(entry.key)}
                  onBlur={() => setPendingRemoveKey(null)}
                >
                  Remove?
                </button>
              ) : (
                <button
                  type="button"
                  title="Remove legend entry"
                  className="shrink-0 px-0.5 text-zinc-400 opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                  onClick={() => handleRemove(entry.key)}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
