import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { DiagramEdge, DiagramNode, DiagramNodeData } from "./types";

export type FlowNode = Node<DiagramNodeData>;

/** React Flow needs parents before their children, so containers are listed first. */
export function toFlowNodes(nodes: DiagramNode[], selectedIds: ReadonlySet<string>): FlowNode[] {
  const ordered = [
    ...nodes.filter((node) => node.type === "container"),
    ...nodes.filter((node) => node.type !== "container"),
  ];
  return ordered.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    width: node.size.width,
    height: node.size.height,
    parentId: node.parentId,
    extent: node.parentId ? "parent" : undefined,
    zIndex: node.zIndex,
    selected: selectedIds.has(node.id),
    data: node.data,
  }));
}

export function fromFlowNodes(flowNodes: FlowNode[]): DiagramNode[] {
  return flowNodes.map((node) => ({
    id: node.id,
    type: node.type as "container" | "block",
    position: node.position,
    size: {
      width: node.width ?? node.measured?.width ?? 160,
      height: node.height ?? node.measured?.height ?? 80,
    },
    parentId: node.parentId,
    zIndex: node.zIndex,
    data: node.data,
  }));
}

/** What a connection says on the canvas: "Orders · REST", or whichever half exists. */
export function connectionCaption(edge: Pick<DiagramEdge, "label" | "protocol">): string {
  return [edge.label, edge.protocol].filter(Boolean).join(" · ");
}

export function toFlowEdges(edges: DiagramEdge[], selectedId: string | null, dark: boolean): Edge[] {
  const color = dark ? "#a1a1aa" : "#52525b";
  return edges.map((edge) => {
    const direction = edge.direction ?? "forward";
    const marker = { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };
    const caption = connectionCaption(edge);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceSide ?? null,
      targetHandle: edge.targetSide ?? null,
      type: "smoothstep",
      selected: edge.id === selectedId,
      interactionWidth: 24,
      label: caption || undefined,
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
      // Explicit colours, not React Flow's CSS variables: image export renders outside the canvas, where those are undefined.
      labelStyle: { fontSize: 11, fontWeight: 500, fill: dark ? "#e4e4e7" : "#18181b" },
      labelBgStyle: { fill: dark ? "#18181b" : "#ffffff", fillOpacity: 1, stroke: dark ? "#3f3f46" : "#d4d4d8" },
      markerEnd: direction === "none" ? undefined : marker,
      markerStart: direction === "both" ? marker : undefined,
      style: {
        stroke: edge.id === selectedId ? "#2563eb" : color,
        strokeWidth: edge.id === selectedId ? 2.5 : 1.75,
        strokeDasharray: edge.style === "dashed" ? "7 5" : undefined,
      },
    };
  });
}
