import { beforeEach, describe, expect, it } from "vitest";
import { MAX_CHECKPOINTS, summarise } from "@/lib/diagram/checkpoints";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { useDiagramStore } from "@/lib/diagram/store";
import { parseDiagram } from "@/lib/diagram/validate";
import type { Diagram, DiagramNode } from "@/lib/diagram/types";

const block = (id: string, label: string): DiagramNode => ({
  id,
  type: "block",
  position: { x: 0, y: 0 },
  size: { width: 100, height: 50 },
  data: { kind: "block", label, containerId: null },
});

function diagramWith(labels: string[]): Diagram {
  const diagram = createBlankDiagram("Plan");
  diagram.sections[0] = { ...diagram.sections[0], name: "Current", nodes: labels.map((label, index) => block(`n${index}`, label)) };
  return diagram;
}

const store = () => useDiagramStore.getState();
const labels = () => store().diagram.sections[0].nodes.map((node) => node.data.label);

describe("checkpoints", () => {
  beforeEach(() => store().loadDiagram(diagramWith(["Web", "API"])));

  it("keeps the diagram as it was, whatever happens after", () => {
    const saved = store().saveCheckpoint("  Approved  ")!;
    expect(saved.name).toBe("Approved");
    store().addBlock({ x: 10, y: 10 });
    expect(store().diagram.sections[0].nodes).toHaveLength(3);
    expect(store().diagram.checkpoints![0].snapshot.sections[0].nodes).toHaveLength(2);
    expect(summarise(saved.snapshot)).toBe("1 tab, 2 components, 0 connections");
  });

  it("names an unnamed one, and stops at the limit", () => {
    expect(store().saveCheckpoint("   ")!.name).toBe("Checkpoint 1");
    for (let i = 1; i < MAX_CHECKPOINTS; i++) expect(store().saveCheckpoint(`v${i}`)).not.toBeNull();
    expect(store().saveCheckpoint("one too many")).toBeNull();
    expect(store().diagram.checkpoints).toHaveLength(MAX_CHECKPOINTS);
  });

  it("restores as one undo step, keeping the checkpoints and the comments", () => {
    store().addComment("n0", "Check this", "Sam");
    const saved = store().saveCheckpoint("Before")!;
    store().addBlock({ x: 10, y: 10 });
    store().restoreCheckpoint(saved.id);
    expect(labels()).toEqual(["Web", "API"]);
    expect(store().diagram.checkpoints).toHaveLength(1);
    expect(store().diagram.comments).toHaveLength(1);
    store().undo();
    expect(labels()).toHaveLength(3);
  });

  it("opens a checkpoint's tabs beside the current ones, with fresh ids, ready for Compare tabs", () => {
    const saved = store().saveCheckpoint("v1")!;
    store().addBlock({ x: 10, y: 10 });
    store().addCheckpointAsTabs(saved.id);
    const { sections, activeSectionId } = store().diagram;
    expect(sections.map((section) => section.name)).toEqual(["Current", "v1 — Current"]);
    expect(activeSectionId).toBe(sections[1].id);
    expect(sections[1].nodes).toHaveLength(2);
    const ids = sections.flatMap((section) => section.nodes.map((node) => node.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("deletes one", () => {
    const saved = store().saveCheckpoint("v1")!;
    store().deleteCheckpoint(saved.id);
    expect(store().diagram.checkpoints).toBeUndefined();
  });
});

describe("checkpoints in a file", () => {
  it("round-trip with their contents", () => {
    store().loadDiagram(diagramWith(["Web"]));
    store().saveCheckpoint("v1");
    store().addBlock({ x: 0, y: 0 });
    const { diagram, fixes } = parseDiagram(JSON.parse(JSON.stringify(store().diagram)));
    expect(fixes).toEqual([]);
    expect(diagram.checkpoints).toHaveLength(1);
    expect(diagram.checkpoints![0]).toMatchObject({ name: "v1" });
    expect(diagram.checkpoints![0].snapshot.sections[0].nodes).toHaveLength(1);
    expect(diagram.sections[0].nodes).toHaveLength(2);
  });

  it("drop the unreadable, repeated and surplus ones with a note, without disturbing the diagram", () => {
    const good = { id: "c1", name: "ok", createdAt: "2026-10-29T10:00:00Z", snapshot: { ...diagramWith(["Web"]) } };
    const file = {
      ...diagramWith(["A", "B"]),
      checkpoints: [good, { ...good }, { id: "c2", name: "bad", snapshot: "nope" }, { id: "c3", name: "worse", snapshot: { schemaVersion: 1, sections: "x" } }],
    };
    const { diagram, fixes } = parseDiagram(JSON.parse(JSON.stringify(file)));
    expect(diagram.checkpoints!.map((checkpoint) => checkpoint.id)).toEqual(["c1"]);
    expect(fixes.join(" ")).toMatch(/Left out 3 checkpoints/);
    expect(diagram.sections[0].nodes).toHaveLength(2);
  });

  it("keep the file's own count of shortened texts", () => {
    const file = {
      ...diagramWith(["x".repeat(300)]),
      checkpoints: [{ id: "c1", name: "ok", snapshot: diagramWith(["y"]) }],
    };
    expect(parseDiagram(JSON.parse(JSON.stringify(file))).fixes.join(" ")).toMatch(/Shortened 1 very long name/);
  });
});
