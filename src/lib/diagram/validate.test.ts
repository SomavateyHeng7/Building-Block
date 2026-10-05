import { describe, expect, it } from "vitest";
import { createBlankDiagram } from "./factory";
import { DiagramFileError, parseDiagram } from "./validate";

const node = (overrides: Record<string, unknown> = {}) => ({
  id: "n1",
  type: "block",
  position: { x: 10, y: 20 },
  size: { width: 100, height: 40 },
  data: { kind: "block", label: "API" },
  ...overrides,
});

const diagramWith = (nodes: unknown[], extra: Record<string, unknown> = {}) => ({
  ...createBlankDiagram(),
  sections: [{ id: "s1", name: "Current", nodes }],
  activeSectionId: "s1",
  ...extra,
});

describe("parseDiagram", () => {
  it("round-trips a valid diagram without repairs", () => {
    const input = diagramWith([node()]);
    const { diagram, fixes } = parseDiagram(JSON.parse(JSON.stringify(input)));
    expect(fixes).toEqual([]);
    expect(diagram.sections[0].nodes[0].data.label).toBe("API");
    expect(diagram.id).toBe(input.id);
  });

  it.each([null, "text", [], 42, {}, { schemaVersion: 1 }])("rejects non-diagram input %j", (input) => {
    expect(() => parseDiagram(input)).toThrow(DiagramFileError);
  });

  it("rejects diagrams from a newer schema", () => {
    expect(() => parseDiagram({ schemaVersion: 2, sections: [] })).toThrow(/newer version/);
  });

  it("uses the default legend when it is missing", () => {
    const { diagram, fixes } = parseDiagram({ ...diagramWith([]), legend: undefined });
    expect(diagram.legend.length).toBeGreaterThan(0);
    expect(fixes.join()).toMatch(/default legend/);
  });

  it("drops invalid and duplicate legend entries", () => {
    const legend = [
      { key: "a", label: "A", color: "#112233" },
      { key: "a", label: "Dup", color: "#112233" },
      { key: "b", label: "B", color: "red" },
      "junk",
    ];
    const { diagram, fixes } = parseDiagram({ ...diagramWith([]), legend });
    expect(diagram.legend).toEqual([{ key: "a", label: "A", color: "#112233" }]);
    expect(fixes.join()).toMatch(/Skipped 3 invalid legend entries/);
  });

  it("skips unreadable and duplicate nodes", () => {
    const { diagram, fixes } = parseDiagram(diagramWith([node(), node(), { nope: true }, null]));
    expect(diagram.sections[0].nodes).toHaveLength(1);
    expect(fixes.join()).toMatch(/duplicate/);
    expect(fixes.join()).toMatch(/couldn't be read/);
  });

  it("fills in missing label, position and size", () => {
    const { diagram, fixes } = parseDiagram(diagramWith([{ id: "c", type: "container", data: {} }]));
    const [container] = diagram.sections[0].nodes;
    expect(container.data.label).toBe("Untitled Container");
    expect(container.size).toEqual({ width: 320, height: 220 });
    expect(container.position).toEqual({ x: 0, y: 0 });
    expect(fixes.join()).toMatch(/filled in/);
  });

  it("clears a colour key that is not in the legend", () => {
    const { diagram } = parseDiagram(diagramWith([node({ data: { kind: "block", label: "X", colorKey: "gone" } })]));
    expect(diagram.sections[0].nodes[0].data.colorKey).toBeUndefined();
  });

  it("detaches a block whose container is missing", () => {
    const { diagram, fixes } = parseDiagram(diagramWith([node({ parentId: "ghost" })]));
    expect(diagram.sections[0].nodes[0].parentId).toBeUndefined();
    expect(fixes.join()).toMatch(/out of a container/);
  });

  it("keeps a nested block inside a real container and sets containerId", () => {
    const container = node({ id: "c1", type: "container", data: { kind: "container", label: "C" } });
    const { diagram } = parseDiagram(diagramWith([container, node({ parentId: "c1" })]));
    const block = diagram.sections[0].nodes.find((n) => n.id === "n1")!;
    expect(block.parentId).toBe("c1");
    expect(block.data.kind === "block" && block.data.containerId).toBe("c1");
  });

  it("keeps a container-in-container on screen by detaching it with an absolute position", () => {
    const outer = node({ id: "o", type: "container", position: { x: 100, y: 100 }, data: { kind: "container", label: "O" } });
    const inner = node({ id: "i", type: "container", parentId: "o", position: { x: 5, y: 6 }, data: { kind: "container", label: "I" } });
    const { diagram } = parseDiagram(diagramWith([outer, inner]));
    const result = diagram.sections[0].nodes.find((n) => n.id === "i")!;
    expect(result.parentId).toBeUndefined();
    expect(result.position).toEqual({ x: 105, y: 106 });
  });

  it("gives duplicate section ids new ids and falls back to a valid active section", () => {
    const input = {
      ...createBlankDiagram(),
      sections: [
        { id: "s", name: "A", nodes: [] },
        { id: "s", name: "B", nodes: [] },
      ],
      activeSectionId: "missing",
    };
    const { diagram } = parseDiagram(input);
    expect(new Set(diagram.sections.map((s) => s.id)).size).toBe(2);
    expect(diagram.activeSectionId).toBe(diagram.sections[0].id);
  });

  it("adds a blank section when there are none", () => {
    const { diagram } = parseDiagram({ ...createBlankDiagram(), sections: [] });
    expect(diagram.sections).toHaveLength(1);
  });

  it("trims details and drops empty ones", () => {
    const { diagram } = parseDiagram(
      diagramWith([node({ data: { kind: "block", label: "X", technology: "  Go ", owner: "   " } })]),
    );
    const data = diagram.sections[0].nodes[0].data;
    expect(data.technology).toBe("Go");
    expect(data.owner).toBeUndefined();
  });
});
