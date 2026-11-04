import type { Checkpoint } from "./checkpoints";
import type { ComponentIconKey } from "./componentIcons";

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
  /** An http(s) address for the ticket, decision record or document this relates to. */
  link?: string;
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

/**
 * How a component is drawn, after the flowchart shapes draw.io offers: a box (the default), a pill for a start or
 * end, a diamond for a decision, a parallelogram for data in or out, a document with a wavy foot, a database
 * cylinder, and a subprocess (a box with double sides).
 */
export type BlockShape = "process" | "terminal" | "decision" | "data" | "document" | "database" | "subprocess";

export interface BlockNodeData extends NodeDetails {
  [key: string]: unknown;
  kind: "block";
  label: string;
  /** Undefined when unassigned, e.g. after its legend entry was removed. */
  colorKey?: BlockColorKey;
  containerId: string | null;
  /** A built-in icon shown beside the name; absent means none. */
  icon?: ComponentIconKey;
  /** Defaults to "process" (a box). */
  shape?: BlockShape;
  /** The component's internal design (L2). Absent until something is drawn in it. */
  detail?: ComponentDetail;
}

/**
 * What a component is made of (L2): its own containers, components and connections, drawn on a canvas
 * of their own. Kept inside the component so it travels with it. One level deep: the components in
 * here don't have internal designs of their own.
 */
export interface ComponentDetail {
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
}

export type TextAlign = "left" | "center" | "right";

/**
 * A free text box: a heading, a caption or a note written straight on the canvas. Not a component, so it
 * has no connections, category or internal design. `label` holds the text, so search and compare read it.
 */
export interface TextNodeData extends NodeDetails {
  [key: string]: unknown;
  kind: "text";
  label: string;
  /** Text boxes have no category; present so every node's `colorKey` can be read. */
  colorKey?: undefined;
  /** In canvas pixels; defaults to 14. */
  fontSize?: number;
  /** Defaults to "left". */
  align?: TextAlign;
  bold?: boolean;
}

export type DiagramNodeData = ContainerNodeData | BlockNodeData | TextNodeData;

export interface DiagramNode {
  id: string;
  type: "container" | "block" | "text";
  position: Position;
  size: Size;
  parentId?: string;
  data: DiagramNodeData;
  zIndex?: number;
}

/** Which side of a component a connection attaches to. */
export type ConnectionSide = "top" | "right" | "bottom" | "left";
/** Where the arrowheads go: at the target, at both ends, or nowhere. */
export type ConnectionDirection = "forward" | "both" | "none";
export type ConnectionLineStyle = "solid" | "dashed";
/** How the line runs: in right angles, as a curve, or straight from end to end. */
export type ConnectionShape = "step" | "curved" | "straight";

/** A line between two components: how they interact (L1). */
export interface DiagramEdge {
  id: string;
  /** Component ids in the same section. */
  source: string;
  target: string;
  sourceSide?: ConnectionSide;
  targetSide?: ConnectionSide;
  /** What flows, e.g. "Orders". */
  label?: string;
  /** How it flows, e.g. "REST", "Kafka". */
  protocol?: string;
  description?: string;
  /** Defaults to "forward". */
  direction?: ConnectionDirection;
  /** Defaults to "solid"; dashed is the usual convention for asynchronous calls. */
  style?: ConnectionLineStyle;
  /** Defaults to "step" (right angles). */
  shape?: ConnectionShape;
  /**
   * Where this connection comes in the flow (1, 2, 3…). Shown on the line while the diagram's
   * `numberConnections` is on; set by "Number in flow order" or typed in.
   */
  step?: number;
  /**
   * How far the middle of the line is moved from where it's drawn by default, in canvas pixels; set by
   * dragging the dot on a selected connection. Relative, so the line keeps its bend when components move.
   */
  bend?: Position;
}

/** Someone or something taking part in a sequence: a column with a lifeline. */
export interface SequenceParticipant {
  id: string;
  label: string;
  /** A box, or a stick figure for a person. Defaults to "participant". */
  shape?: "participant" | "actor";
  colorKey?: BlockColorKey;
  description?: string;
  /**
   * A component on an architecture tab that this participant stands for. While set, the participant takes that
   * component's name and colour (kept in step by the store); it's dropped if the component goes.
   */
  component?: { sectionId: string; id: string };
}

/** How a message is sent: a call (solid, filled arrow), asynchronous (solid, open arrow) or a reply (dashed). */
export type SequenceMessageKind = "call" | "async" | "reply";

/** Mermaid's frames around steps: repeated, alternatives, optional, in parallel, must-succeed, or a way out. */
export type SequenceBlockKind = "loop" | "alt" | "opt" | "par" | "critical" | "break";

/**
 * One step down a sequence: a message between participants (or to itself), a note over some of them, or the
 * start, divider or end of a frame around steps (Mermaid's `loop` … `else` … `end`). Frames are markers in the
 * list, as Mermaid writes them, so steps keep one order; `balanceSteps` repairs markers that don't pair up.
 */
export type SequenceStep =
  | {
      id: string;
      type: "message";
      from: string;
      /** The same as `from` for a call to itself. */
      to: string;
      label?: string;
      protocol?: string;
      /** Defaults to "call". */
      kind?: SequenceMessageKind;
      /** Starts an activation bar on the receiver (Mermaid's `->>+`). */
      activate?: boolean;
      /** Ends the sender's activation bar (Mermaid's `-->>-`). */
      deactivate?: boolean;
    }
  | {
      id: string;
      type: "note";
      /** One participant, or the first and last of a span. */
      over: string[];
      text: string;
    }
  | {
      id: string;
      type: "block";
      kind: SequenceBlockKind;
      /** The condition or description, e.g. "Every minute", "Payment approved". */
      label?: string;
    }
  | {
      /** The next part of the open frame: `else` in alt, `and` in par, `option` in critical. */
      id: string;
      type: "else";
      label?: string;
    }
  | { id: string; type: "end" };

export type SequenceMessage = Extract<SequenceStep, { type: "message" }>;
export type SequenceNote = Extract<SequenceStep, { type: "note" }>;
export type SequenceBlock = Extract<SequenceStep, { type: "block" }>;

/** A sequence diagram: participants left to right, and what happens between them top to bottom. */
export interface SequenceDiagram {
  participants: SequenceParticipant[];
  steps: SequenceStep[];
  /** Number the messages 1, 2, 3… Defaults to true. */
  numbered?: boolean;
}

export interface DiagramSection {
  id: string;
  name: string;
  /**
   * What the tab holds: containers, components and connections (the default), or a sequence diagram. A sequence
   * tab keeps `nodes` empty and its content in `sequence`.
   */
  kind?: "architecture" | "sequence";
  nodes: DiagramNode[];
  /** Connections between components. Absent in files made before connections existed. */
  edges?: DiagramEdge[];
  /** Set on sequence tabs. */
  sequence?: SequenceDiagram;
}

/** A reviewer's note on a component, container or connection. */
export interface ReviewComment {
  id: string;
  /** The id of what it is about: a node or a connection, on any tab or internal design. */
  targetId: string;
  /** The name typed when it was written; there are no accounts. */
  author: string;
  text: string;
  /** ISO time. */
  createdAt: string;
  resolved?: boolean;
}

/** A logo and an accent colour for exports. */
export interface Branding {
  /** A small PNG, JPEG or WebP as a data address. */
  logo?: string;
  /** #rrggbb. */
  color?: string;
}

export interface Diagram {
  schemaVersion: 1;
  id: string;
  name: string;
  legend: LegendEntry[];
  sections: DiagramSection[];
  activeSectionId: string;
  /** A component in the active section whose internal design (L2) is open; absent at L1. */
  activeDetailId?: string;
  /** Show each component's technology under its label. Defaults to true. */
  showTechnology?: boolean;
  /** Show each connection's step number (see `DiagramEdge.step`) on the line. Defaults to false. */
  numberConnections?: boolean;
  /** Added to exports: a logo and an accent colour. */
  branding?: Branding;
  /** Review comments, newest last. */
  comments?: ReviewComment[];
  /** Named snapshots of the diagram, oldest first (see checkpoints.ts). */
  checkpoints?: Checkpoint[];
  createdAt: string;
  updatedAt: string;
}
