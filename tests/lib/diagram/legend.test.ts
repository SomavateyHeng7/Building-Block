import { beforeEach, describe, expect, it } from "vitest";
import { everyNode, getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { LEGEND_PRESETS } from "@/lib/diagram/defaultLegend";

const store = () => useDiagramStore.getState();
const keys = () => store().diagram.legend.map((entry) => entry.key);

describe("legend order and removal", () => {
  let first: string;
  let second: string;
  let third: string;

  beforeEach(() => {
    store().loadDiagram({ ...createBlankDiagram(), legend: [] });
    first = store().addLegendEntry();
    second = store().addLegendEntry();
    third = store().addLegendEntry();
  });

  it("moves an entry to a new place, as one undo step, ignoring no-op and unknown moves", () => {
    store().moveLegendEntry(third, 0);
    expect(keys()).toEqual([third, first, second]);
    store().moveLegendEntry(third, 99);
    expect(keys()).toEqual([first, second, third]);
    const steps = store().past.length;
    store().moveLegendEntry(third, 2);
    store().moveLegendEntry("nope", 0);
    expect(store().past.length).toBe(steps);
    store().undo();
    expect(keys()).toEqual([third, first, second]);
  });

  it("moves the removed category's items to another, including inside internal designs", () => {
    store().addBlock({ x: 0, y: 0 }, null, first);
    const outer = store().selectedNodeIds[0];
    store().openDetail(outer);
    store().addBlock({ x: 0, y: 0 }, null, second);
    store().closeDetail();
    store().addBlock({ x: 200, y: 0 }, null, second);

    store().removeLegendEntry(second, third);
    expect(keys()).toEqual([first, third]);
    expect(everyNode(store().diagram).map((node) => node.data.colorKey)).toEqual([first, third, third]);
    store().undo();
    expect(everyNode(store().diagram).map((node) => node.data.colorKey)).toEqual([first, second, second]);
  });

  it("leaves items unassigned without a replacement, or with one that doesn't exist", () => {
    store().addBlock({ x: 0, y: 0 }, null, first);
    store().removeLegendEntry(first, "nope");
    expect(getActiveSection(store().diagram).nodes[0].data.colorKey).toBeUndefined();
  });
});

describe("legend presets", () => {
  beforeEach(() => store().loadDiagram({ ...createBlankDiagram(), legend: [] }));

  it("adds a standard's categories once, as one undo step", () => {
    const c4 = LEGEND_PRESETS.find((preset) => preset.id === "c4")!;
    expect(store().addLegendEntries(c4.entries)).toBe(c4.entries.length);
    expect(store().diagram.legend.map((entry) => entry.label)).toEqual(c4.entries.map((entry) => entry.label));
    expect(new Set(keys()).size).toBe(c4.entries.length);

    expect(store().addLegendEntries(c4.entries)).toBe(0);
    expect(store().diagram.legend).toHaveLength(c4.entries.length);

    store().undo();
    expect(store().diagram.legend).toHaveLength(0);
  });
});
