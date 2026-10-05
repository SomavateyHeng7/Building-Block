"use client";

import { useDiagramStore } from "@/lib/diagram/store";

export const PALETTE_DATA_FORMAT = "application/building-block-node";

export type PaletteDragPayload =
  | { kind: "container" }
  | { kind: "block"; colorKey: string };

function startDrag(event: React.DragEvent, payload: PaletteDragPayload) {
  event.dataTransfer.setData(PALETTE_DATA_FORMAT, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "move";
}

export default function Sidebar() {
  const legend = useDiagramStore((state) => state.diagram.legend);

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Containers
        </h2>
        <div
          draggable
          onDragStart={(event) => startDrag(event, { kind: "container" })}
          className="cursor-grab rounded border-2 border-dashed border-zinc-400 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 active:cursor-grabbing dark:bg-zinc-900 dark:text-zinc-200"
        >
          Container
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Components
        </h2>
        <div className="flex flex-col gap-1.5">
          {legend.length === 0 && (
            <p className="text-[11px] leading-snug text-zinc-400">
              Add a legend entry to get a draggable component for it.
            </p>
          )}
          {legend.map((entry) => (
            <div
              key={entry.key}
              draggable
              onDragStart={(event) => startDrag(event, { kind: "block", colorKey: entry.key })}
              className="flex cursor-grab items-center gap-2 rounded border border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-700 active:cursor-grabbing dark:border-zinc-700 dark:text-zinc-200"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm border border-black/20"
                style={{ backgroundColor: entry.color }}
              />
              <span className="truncate">{entry.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-snug text-zinc-400">
        Drag an item onto the canvas. Drop a component on top of a container to nest it inside.
      </p>
    </aside>
  );
}
