import { describe, expect, it } from "vitest";
import { legendToJson, parseLegendFile } from "@/lib/diagram/legendFile";
import { createBlankDiagram } from "@/lib/diagram/factory";

describe("legend files", () => {
  it("round-trips names and colours, leaving the diagram's keys behind", () => {
    const { legend } = createBlankDiagram();
    expect(legendToJson(legend)).not.toContain('"key"');
    const { entries, skipped } = parseLegendFile(legendToJson(legend));
    expect(entries).toEqual(legend.map(({ label, color }) => ({ label, color })));
    expect(skipped).toBe(0);
  });

  it("reads the legend out of a whole diagram file", () => {
    const diagram = createBlankDiagram();
    expect(parseLegendFile(JSON.stringify(diagram)).entries).toHaveLength(diagram.legend.length);
  });

  it("skips unusable and repeated entries, and tidies colours", () => {
    const file = JSON.stringify({
      kind: "building-block-legend",
      version: 1,
      legend: [{ label: "New", color: "abc" }, { label: "new", color: "#000000" }, { label: "", color: "#fff" }, { label: "Bad", color: "red" }, null],
    });
    expect(parseLegendFile(file)).toEqual({ entries: [{ label: "New", color: "#aabbcc" }], skipped: 4 });
  });

  it("refuses what isn't a legend, with a reason", () => {
    expect(() => parseLegendFile("nope")).toThrow(/valid JSON/);
    expect(() => parseLegendFile("{}")).toThrow(/isn't a legend/);
    expect(() => parseLegendFile(JSON.stringify({ kind: "building-block-legend", legend: [] }))).toThrow(/no usable categories/);
  });
});
