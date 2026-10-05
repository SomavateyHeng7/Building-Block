/** Key of a LegendEntry. Legends are user-defined, so any string is valid. */
export type BlockColorKey = string;

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

/** Free-text details an SA records against a node; all optional. */
export interface NodeDetails {
  technology?: string;
  owner?: string;
  description?: string;
  notes?: string;
}

export type HeaderPosition = "top" | "bottom" | "left" | "right";
/** Along the header: left/centre/right for top and bottom headers, top/middle/bottom for side headers. */
export type HeaderAlign = "start" | "center" | "end";
export type OutlineStyle = "solid" | "dashed";

/** How a container looks; every field is optional and falls back to the defaults. */
export interface ContainerStyle {
  /** Defaults to "top". */
  headerPosition?: HeaderPosition;
  /** Defaults to "start". */
  headerAlign?: HeaderAlign;
  /** Defaults to the category colour, or grey without one. */
  outlineColor?: string;
  /** Defaults to "solid". */
  outlineStyle?: OutlineStyle;
}

export interface ContainerNodeData extends NodeDetails, ContainerStyle {
  [key: string]: unknown;
  kind: "container";
  label: string;
  colorKey?: BlockColorKey;
}

export interface BlockNodeData extends NodeDetails {
  [key: string]: unknown;
  kind: "block";
  label: string;
  /** Undefined when unassigned, e.g. after its legend entry was removed. */
  colorKey?: BlockColorKey;
  containerId: string | null;
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
  /** Show each component's technology under its label. Defaults to true. */
  showTechnology?: boolean;
  createdAt: string;
  updatedAt: string;
}
