import type { Diagram, DiagramSection, LegendEntry, Branding } from "./types";

/**
 * Version history without a server: named checkpoints kept inside the diagram file. A checkpoint is a snapshot of
 * what a review is about (name, legend, tabs, branding) at a moment someone chose, such as "Approved by the review
 * board". Restoring one replaces those; comments and the other checkpoints stay.
 */

/** Few enough that a file doesn't grow without limit: each checkpoint is a copy of the diagram. */
export const MAX_CHECKPOINTS = 20;

export interface CheckpointSnapshot {
  name: string;
  legend: LegendEntry[];
  sections: DiagramSection[];
  branding?: Branding;
}

export interface Checkpoint {
  id: string;
  name: string;
  /** ISO time. */
  createdAt: string;
  snapshot: CheckpointSnapshot;
}

/** The part of a diagram a checkpoint keeps. The arrays are shared, not copied: the store never changes them in place. */
export function snapshotOf(diagram: Diagram): CheckpointSnapshot {
  return {
    name: diagram.name,
    legend: diagram.legend,
    sections: diagram.sections,
    ...(diagram.branding ? { branding: diagram.branding } : {}),
  };
}

/** "3 tabs, 24 components, 31 connections", for choosing between checkpoints. */
export function summarise(snapshot: CheckpointSnapshot): string {
  let components = 0;
  let connections = 0;
  for (const section of snapshot.sections) {
    components += section.nodes.filter((node) => node.type === "block").length;
    connections += section.edges?.length ?? 0;
  }
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${plural(snapshot.sections.length, "tab")}, ${plural(components, "component")}, ${plural(connections, "connection")}`;
}

/** A name for the next checkpoint when someone doesn't give one: "Checkpoint 3". */
export function nextCheckpointName(checkpoints: Checkpoint[] | undefined): string {
  return `Checkpoint ${(checkpoints?.length ?? 0) + 1}`;
}
