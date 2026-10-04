import type { Node } from "@xyflow/react";
import type { DiagramNode, DiagramNodeData } from "./types";

export type FlowNode = Node<DiagramNodeData>;

export function toFlowNodes(nodes: DiagramNode[]): FlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    width: node.size.width,
    height: node.size.height,
    parentId: node.parentId,
    extent: node.parentId ? "parent" : undefined,
    zIndex: node.zIndex,
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
