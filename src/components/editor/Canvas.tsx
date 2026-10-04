"use client";

import { useCallback, useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
  useReactFlow,
  type NodeChange,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { fromFlowNodes, toFlowNodes, type FlowNode } from "@/lib/diagram/flowAdapter";
import ContainerNode from "./nodes/ContainerNode";
import BlockNode from "./nodes/BlockNode";
import { PALETTE_DATA_FORMAT, type PaletteDragPayload } from "./Sidebar";
import type { BlockColorKey } from "@/lib/diagram/types";

const nodeTypes = { container: ContainerNode, block: BlockNode };

function findContainerAtPoint(containers: FlowNode[], point: { x: number; y: number }) {
  return containers.find((container) => {
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

export default function Canvas() {
  const diagram = useDiagramStore((state) => state.diagram);
  const setActiveSectionNodes = useDiagramStore((state) => state.setActiveSectionNodes);
  const selectNode = useDiagramStore((state) => state.selectNode);
  const addContainer = useDiagramStore((state) => state.addContainer);
  const addBlock = useDiagramStore((state) => state.addBlock);
  const { getIntersectingNodes, screenToFlowPosition } = useReactFlow();

  const section = getActiveSection(diagram);
  const flowNodes = useMemo(() => toFlowNodes(section.nodes), [section.nodes]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, flowNodes) as FlowNode[];
      setActiveSectionNodes(fromFlowNodes(updated));
    },
    [flowNodes, setActiveSectionNodes],
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type !== "block") return;

      const current = flowNodes.find((candidate) => candidate.id === node.id);
      if (!current) return;

      const overlap = getIntersectingNodes(node).find((candidate) => candidate.type === "container");
      const newParentId = overlap?.id;
      if (newParentId === current.parentId) return;

      const containers = flowNodes.filter((candidate) => candidate.type === "container");
      const oldParent = containers.find((candidate) => candidate.id === current.parentId);
      const newParent = containers.find((candidate) => candidate.id === newParentId);

      const absoluteX = node.position.x + (oldParent?.position.x ?? 0);
      const absoluteY = node.position.y + (oldParent?.position.y ?? 0);

      const nextPosition = newParent
        ? { x: absoluteX - newParent.position.x, y: absoluteY - newParent.position.y }
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
      setActiveSectionNodes(fromFlowNodes(updated));
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
        ? { x: point.x - target.position.x - 70, y: point.y - target.position.y - 28 }
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
      onNodesChange={handleNodesChange}
      onNodeDragStop={handleNodeDragStop}
      onPaneClick={() => selectNode(null)}
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
