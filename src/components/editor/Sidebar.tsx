"use client";

import { useReactFlow } from "@xyflow/react";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { nextSlotInContainer } from "@/lib/diagram/layout";
import type { BlockColorKey } from "@/lib/diagram/types";
import { Icon } from "./Icon";

export const PALETTE_DATA_FORMAT = "application/building-block-node";

const HEADING = "mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-500";
const KBD =
  "rounded border border-zinc-200 px-1.5 font-mono text-[10px] font-medium normal-case text-zinc-400 dark:border-zinc-700";
const ITEM =
  "group flex cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:border-zinc-200 hover:bg-zinc-50 focus-visible:border-zinc-300 focus-visible:outline-none active:cursor-grabbing pointer-coarse:py-2.5 dark:text-zinc-200 dark:hover:border-zinc-800 dark:hover:bg-zinc-900";
const GRIP = "h-4 w-4 shrink-0 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600";

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

  function itemProps(add: () => void, payload: PaletteDragPayload) {
    return {
      role: "button",
      tabIndex: 0,
      draggable: true,
      onDragStart: (event: React.DragEvent) => startDrag(event, payload),
      onClick: add,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          add();
        }
      },
    } as const;
  }

  return (
    <aside className={`flex flex-col gap-5 overflow-y-auto border-r border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 ${className}`}>
      <section>
        <h2 className={HEADING}>
          Containers
          <kbd className={KBD} title="Keyboard shortcut">C</kbd>
        </h2>
        <div {...itemProps(tapAddContainer, { kind: "container" })} className={ITEM}>
          <span aria-hidden className="h-5 w-7 shrink-0 rounded border-2 border-dashed border-zinc-400 dark:border-zinc-500" />
          <span className="flex-1 truncate">Container</span>
          <Icon name="grip" className={GRIP} />
        </div>
      </section>

      <section>
        <h2 className={HEADING}>
          Components
          <kbd className={KBD} title="Keyboard shortcut">B</kbd>
        </h2>
        <div className="flex flex-col gap-1">
          {legend.length === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-xs leading-snug text-zinc-500 dark:border-zinc-700">
              Add a legend entry to get a component for it.
            </p>
          )}
          {legend.map((entry) => (
            <div key={entry.key} {...itemProps(() => tapAddBlock(entry.key), { kind: "block", colorKey: entry.key })} className={ITEM}>
              <span
                aria-hidden
                className="h-5 w-7 shrink-0 rounded border border-black/15 dark:border-white/15"
                style={{ backgroundColor: entry.color }}
              />
              <span className="flex-1 truncate" title={entry.label}>{entry.label}</span>
              <Icon name="grip" className={GRIP} />
            </div>
          ))}
        </div>
      </section>

      <p className="mt-auto rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        Drag onto the canvas or click to add. Drop a component on a container, or select the container first, to put it inside.
      </p>
    </aside>
  );
}
