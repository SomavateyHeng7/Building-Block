"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  applyNodeChanges,
  useReactFlow,
  type NodeChange,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { useMounted } from "@/components/theme-toggle";
import { getActiveSection, useDiagramStore, type NodesChangeOptions } from "@/lib/diagram/store";
import { fromFlowNodes, toFlowNodes, type FlowNode } from "@/lib/diagram/flowAdapter";
import { containerInsets, growContainerToFit } from "@/lib/diagram/layout";
import ContainerNode from "./nodes/ContainerNode";
import BlockNode from "./nodes/BlockNode";
import { Icon } from "./Icon";
import { PALETTE_DATA_FORMAT, type PaletteDragPayload } from "./Sidebar";
import type { BlockColorKey, ContainerNodeData } from "@/lib/diagram/types";

function subscribeWide(callback: () => void) {
  const query = window.matchMedia("(min-width: 768px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** The minimap covers too much of a phone-sized canvas. */
function useIsWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 768px)").matches, () => true);
}

const nodeTypes = { container: ContainerNode, block: BlockNode };

/** The top-most container under the point (later containers render above earlier ones). */
function findContainerAtPoint(containers: FlowNode[], point: { x: number; y: number }) {
  return containers.findLast((container) => {
    const width = container.width ?? 0;
    const height = container.height ?? 0;
    return (
      point.x >= container.position.x &&
      point.x <= container.position.x + width &&
      point.y >= container.position.y &&
      point.y <= container.position.y + height
    );
  });
}

/**
 * Decides how a batch of React Flow changes is recorded in undo history.
 * Returns null when the batch is only selection or size measurement — not an edit.
 */
function historyOptionsFor(changes: NodeChange[]): NodesChangeOptions | null {
  const resized = changes.filter((change) => change.type === "dimensions" && change.resizing !== undefined);
  if (resized.length) {
    return { coalesceKey: `resize:${resized.map((change) => ("id" in change ? change.id : "")).join(",")}` };
  }
  const moved = changes.filter((change) => change.type === "position");
  if (moved.length) {
    return { coalesceKey: `move:${moved.map((change) => ("id" in change ? change.id : "")).join(",")}` };
  }
  if (changes.some((change) => change.type === "remove" || change.type === "add" || change.type === "replace")) {
    return {};
  }
  return null;
}

export default function Canvas() {
  const diagram = useDiagramStore((state) => state.diagram);
  const selectedNodeIds = useDiagramStore((state) => state.selectedNodeIds);
  const setActiveSectionNodes = useDiagramStore((state) => state.setActiveSectionNodes);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const addContainer = useDiagramStore((state) => state.addContainer);
  const addBlock = useDiagramStore((state) => state.addBlock);
  const { getIntersectingNodes, screenToFlowPosition } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const wide = useIsWide();
  const colorMode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const section = getActiveSection(diagram);

  /** The middle of what's on screen, in diagram coordinates. */
  function paneCenter() {
    const pane = document.querySelector(".react-flow")?.getBoundingClientRect();
    return screenToFlowPosition({
      x: pane ? pane.left + pane.width / 2 : window.innerWidth / 2,
      y: pane ? pane.top + pane.height / 2 : window.innerHeight / 2,
    });
  }

  const flowNodes = useMemo(
    () => toFlowNodes(section.nodes, new Set(selectedNodeIds)),
    [section.nodes, selectedNodeIds],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Selection lives in the store; React Flow reports clicks, shift-clicks and box selection here.
      const selectChanges = changes.filter((change) => change.type === "select");
      const removed = new Set(
        changes.flatMap((change) => (change.type === "remove" ? [change.id] : [])),
      );
      if (selectChanges.length || removed.size) {
        const next = new Set(selectedNodeIds);
        for (const change of selectChanges) {
          if (change.selected) next.add(change.id);
          else next.delete(change.id);
        }
        removed.forEach((id) => next.delete(id));
        setSelection([...next]);
      }

      const options = historyOptionsFor(changes);
      if (!options) return;
      const updated = applyNodeChanges(changes, flowNodes) as FlowNode[];
      setActiveSectionNodes(fromFlowNodes(updated), options);
    },
    [flowNodes, selectedNodeIds, setActiveSectionNodes, setSelection],
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type !== "block") return;

      const current = flowNodes.find((candidate) => candidate.id === node.id);
      if (!current) return;

      const overlap = getIntersectingNodes(node)
        .filter((candidate) => candidate.type === "container")
        .at(-1);
      const newParentId = overlap?.id;
      if (newParentId === current.parentId) return;

      const containers = flowNodes.filter((candidate) => candidate.type === "container");
      const oldParent = containers.find((candidate) => candidate.id === current.parentId);
      const newParent = containers.find((candidate) => candidate.id === newParentId);

      const absoluteX = node.position.x + (oldParent?.position.x ?? 0);
      const absoluteY = node.position.y + (oldParent?.position.y ?? 0);

      const insets = newParent ? containerInsets(newParent.data as ContainerNodeData) : null;
      const nextPosition =
        newParent && insets
          ? {
              x: Math.max(insets.left, absoluteX - newParent.position.x),
              y: Math.max(insets.top, absoluteY - newParent.position.y),
            }
          : { x: absoluteX, y: absoluteY };

      const updated: FlowNode[] = flowNodes.map((candidate) =>
        candidate.id === node.id
          ? {
              ...candidate,
              position: nextPosition,
              parentId: newParentId,
              extent: newParentId ? ("parent" as const) : undefined,
              data: { ...candidate.data, containerId: newParentId ?? null },
            }
          : candidate,
      );
      const nodes = fromFlowNodes(updated);
      // Same key as the drag itself, so the move and the re-parent undo together.
      setActiveSectionNodes(newParentId ? growContainerToFit(nodes, newParentId) : nodes, {
        coalesceKey: `move:${node.id}`,
      });
    },
    [flowNodes, getIntersectingNodes, setActiveSectionNodes],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData(PALETTE_DATA_FORMAT);
      if (!raw) return;

      const payload = JSON.parse(raw) as PaletteDragPayload;
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      if (payload.kind === "container") {
        addContainer({ x: point.x - 160, y: point.y - 32 });
        return;
      }

      const containers = flowNodes.filter((node) => node.type === "container");
      const target = findContainerAtPoint(containers, point);
      const insets = target ? containerInsets(target.data as ContainerNodeData) : null;
      const position =
        target && insets
          ? {
              x: Math.max(insets.left, point.x - target.position.x - 70),
              y: Math.max(insets.top, point.y - target.position.y - 28),
            }
          : { x: point.x - 70, y: point.y - 28 };

      addBlock(position, target?.id ?? null, payload.colorKey as BlockColorKey);
    },
    [addBlock, addContainer, flowNodes, screenToFlowPosition],
  );

  return (
    <ReactFlow
      key={section.id}
      nodes={flowNodes}
      edges={[]}
      nodeTypes={nodeTypes}
      colorMode={colorMode}
      onNodesChange={handleNodesChange}
      onNodeDragStop={handleNodeDragStop}
      deleteKeyCode={["Backspace", "Delete"]}
      selectionMode={SelectionMode.Partial}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      snapToGrid
      snapGrid={[8, 8]}
      minZoom={0.2}
      maxZoom={2}
      fitView
    >
      <Background gap={16} />
      <Controls />
      {wide && <MiniMap pannable zoomable />}
      {section.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white/90 p-6 text-center text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-400">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <Icon name="layers" className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">This tab is empty</p>
              <p className="mt-1">Start with a container to group your components, or drag items in from the panel.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                onClick={() => {
                  const center = paneCenter();
                  addContainer({ x: center.x - 160, y: center.y - 32 });
                }}
              >
                <Icon name="plus" />
                Container
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                onClick={() => {
                  const center = paneCenter();
                  addBlock({ x: center.x - 70, y: center.y - 28 });
                }}
              >
                <Icon name="plus" />
                Component
              </button>
            </div>
            <p className="hidden text-xs text-zinc-400 pointer-fine:block">
              Or press <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-700">C</kbd> /{" "}
              <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-700">B</kbd>, and{" "}
              <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-700">?</kbd> for all shortcuts
            </p>
          </div>
        </div>
      )}
    </ReactFlow>
  );
}
