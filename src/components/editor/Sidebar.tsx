"use client";

import { useReactFlow } from "@xyflow/react";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { nextSlotInContainer } from "@/lib/diagram/layout";
import type { BlockColorKey } from "@/lib/diagram/types";

export const PALETTE_DATA_FORMAT = "application/building-block-node";

export type PaletteDragPayload =
  | { kind: "container" }
  | { kind: "block"; colorKey: string };

function startDrag(event: React.DragEvent, payload: PaletteDragPayload) {
  event.dataTransfer.setData(PALETTE_DATA_FORMAT, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "move";
}

interface SidebarProps {
  className?: string;
  /** Called after a tap adds something, so a drawer can get out of the way. */
  onAdded?: () => void;
}

export default function Sidebar({ className = "", onAdded }: SidebarProps) {
  const legend = useDiagramStore((state) => state.diagram.legend);
  const addContainer = useDiagramStore((state) => state.addContainer);
  const addBlock = useDiagramStore((state) => state.addBlock);
  const { screenToFlowPosition } = useReactFlow();

  /** Touch screens can't drag from here, so tapping adds at the middle of what's on screen. */
  function canvasCenter() {
    const pane = document.querySelector(".react-flow")?.getBoundingClientRect();
    return screenToFlowPosition({
      x: pane ? pane.left + pane.width / 2 : window.innerWidth / 2,
      y: pane ? pane.top + pane.height / 2 : window.innerHeight / 2,
    });
  }

  function tapAddContainer() {
    const center = canvasCenter();
    addContainer({ x: center.x - 160, y: center.y - 32 });
    onAdded?.();
  }

  function tapAddBlock(colorKey: BlockColorKey) {
    const { diagram, selectedNodeIds } = useDiagramStore.getState();
    const nodes = getActiveSection(diagram).nodes;
    const selected = selectedNodeIds.length === 1 ? nodes.find((node) => node.id === selectedNodeIds[0]) : undefined;
    const containerId = selected?.type === "container" ? selected.id : selected?.parentId;
    if (containerId) {
      addBlock(nextSlotInContainer(nodes, containerId), containerId, colorKey);
    } else {
      const center = canvasCenter();
      addBlock({ x: center.x - 70, y: center.y - 28 }, null, colorKey);
    }
    onAdded?.();
  }

  return (
    <aside className={`flex flex-col gap-4 overflow-y-auto border-r border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 ${className}`}>
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Containers
        </h2>
        <div
          role="button"
          tabIndex={0}
          draggable
          onDragStart={(event) => startDrag(event, { kind: "container" })}
          onClick={tapAddContainer}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              tapAddContainer();
            }
          }}
          className="cursor-grab rounded border-2 border-dashed border-zinc-400 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 active:cursor-grabbing pointer-coarse:py-3 dark:bg-zinc-900 dark:text-zinc-200"
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
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(event) => startDrag(event, { kind: "block", colorKey: entry.key })}
              onClick={() => tapAddBlock(entry.key)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  tapAddBlock(entry.key);
                }
              }}
              className="flex cursor-grab items-center gap-2 rounded border border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-700 active:cursor-grabbing pointer-coarse:py-2.5 pointer-coarse:text-sm dark:border-zinc-700 dark:text-zinc-200"
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
        Drag an item onto the canvas, or tap it to add it. Drop a component on top of a container to nest it inside.
        Select a container first and tapping a component adds it inside.
      </p>
    </aside>
  );
}
