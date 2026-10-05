"use client";

import { useCallback, useMemo } from "react";
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
import { CONTAINER_HEADER, CONTAINER_PADDING, growContainerToFit } from "@/lib/diagram/layout";
import ContainerNode from "./nodes/ContainerNode";
import BlockNode from "./nodes/BlockNode";
import { PALETTE_DATA_FORMAT, type PaletteDragPayload } from "./Sidebar";
import type { BlockColorKey } from "@/lib/diagram/types";

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
  const colorMode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const section = getActiveSection(diagram);
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

      const nextPosition = newParent
        ? {
            x: Math.max(CONTAINER_PADDING, absoluteX - newParent.position.x),
            y: Math.max(CONTAINER_HEADER, absoluteY - newParent.position.y),
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
      const position = target
        ? {
            x: Math.max(CONTAINER_PADDING, point.x - target.position.x - 70),
            y: Math.max(CONTAINER_HEADER, point.y - target.position.y - 28),
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
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}
