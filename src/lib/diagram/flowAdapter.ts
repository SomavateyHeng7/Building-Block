import type { Node } from "@xyflow/react";
import type { DiagramNode, DiagramNodeData } from "./types";

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
