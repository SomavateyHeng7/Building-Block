export type BlockColorKey =
  | "product"
  | "replacement"
  | "enhancement"
  | "new"
  | "microservice"
  | "non-existent"
  | "ai-focus"
  | "rest-api"
  | "third-party";

export interface LegendEntry {
  key: BlockColorKey;
  label: string;
  color: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ContainerNodeData {
  [key: string]: unknown;
  kind: "container";
  label: string;
  colorKey?: BlockColorKey;
  description?: string;
}

export interface BlockNodeData {
  [key: string]: unknown;
  kind: "block";
  label: string;
  colorKey: BlockColorKey;
  containerId: string | null;
  icon?: string;
}

export type DiagramNodeData = ContainerNodeData | BlockNodeData;

export interface DiagramNode {
  id: string;
  type: "container" | "block";
  position: Position;
  size: Size;
  parentId?: string;
  data: DiagramNodeData;
  zIndex?: number;
}

export interface DiagramSection {
  id: string;
  name: string;
  nodes: DiagramNode[];
}

export interface Diagram {
  schemaVersion: 1;
  id: string;
  name: string;
  legend: LegendEntry[];
  sections: DiagramSection[];
  activeSectionId: string;
  createdAt: string;
  updatedAt: string;
}
