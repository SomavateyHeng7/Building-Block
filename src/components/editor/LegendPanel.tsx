"use client";

import { useDiagramStore } from "@/lib/diagram/store";

export default function LegendPanel() {
  const legend = useDiagramStore((state) => state.diagram.legend);
  const updateLegendEntry = useDiagramStore((state) => state.updateLegendEntry);

  return (
    <div className="flex flex-col gap-2 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Legend</h2>
      <div className="flex flex-col gap-1.5">
        {legend.map((entry) => (
          <div key={entry.key} className="flex items-center gap-2">
            <input
              type="color"
              value={entry.color}
              onChange={(event) => updateLegendEntry(entry.key, { color: event.target.value })}
              className="h-6 w-6 shrink-0 cursor-pointer rounded border border-zinc-300 bg-transparent p-0 dark:border-zinc-700"
            />
            <input
              value={entry.label}
              onChange={(event) => updateLegendEntry(entry.key, { label: event.target.value })}
              className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs outline-none hover:border-zinc-300 focus:border-zinc-500 dark:hover:border-zinc-700"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
