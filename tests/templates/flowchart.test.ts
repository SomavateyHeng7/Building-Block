import { beforeEach, describe, expect, it } from "vitest";
import { flowchartTemplate } from "@/templates/flowchart";
import { templates } from "@/templates";
import { parseDiagram } from "@/lib/diagram/validate";
import { flowchartMermaid } from "@/lib/diagram/exportCode";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";

describe("flowchart template", () => {
  it("is offered, with start/end pills, decisions with Yes and No ways out, and a title", () => {
    expect(templates.map((template) => template.id)).toContain("flowchart");
    const section = flowchartTemplate.build().sections[0];
    const shapes = section.nodes.map((node) => (node.data.kind === "block" ? (node.data.shape ?? "process") : node.type));
    expect(shapes.filter((shape) => shape === "terminal")).toHaveLength(4);
    expect(shapes.filter((shape) => shape === "decision")).toHaveLength(2);
    expect(shapes).toContain("text");
    const decisions = section.nodes.filter((node) => node.data.kind === "block" && node.data.shape === "decision");
    for (const decision of decisions) {
      const labels = (section.edges ?? []).filter((edge) => edge.source === decision.id).map((edge) => edge.label);
      expect(labels.sort()).toEqual(["No", "Yes"]);
    }
  });

  it("keeps its shapes through a saved file and exports them to Mermaid", () => {
    const diagram = flowchartTemplate.build();
    const reopened = parseDiagram(JSON.parse(JSON.stringify(diagram))).diagram.sections[0];
    expect(reopened.nodes).toEqual(diagram.sections[0].nodes);
    const code = flowchartMermaid({ title: "Flow", nodes: diagram.sections[0].nodes, edges: diagram.sections[0].edges ?? [] });
    expect(code).toMatch(/\(\["Order received"\]\)/);
    expect(code).toMatch(/\{"Order valid\?"\}/);
  });
});

describe("updateNodeShape", () => {
  beforeEach(() => useDiagramStore.getState().loadDiagram(createBlankDiagram()));

  it("sets a shape, and drops it again for a plain box", () => {
    const store = useDiagramStore.getState;
    store().addBlock({ x: 0, y: 0 });
    const id = store().selectedNodeIds[0];
    store().updateNodeShape(id, "decision");
    expect(getActiveSection(store().diagram).nodes[0].data).toMatchObject({ shape: "decision" });
    store().updateNodeShape(id, "process");
    expect(getActiveSection(store().diagram).nodes[0].data).not.toHaveProperty("shape");
  });
});

describe("draw.io look", () => {
  it("is how the flowchart is drawn, in draw.io's fills, and survives a saved file", () => {
    const diagram = flowchartTemplate.build();
    expect(diagram.sections[0].look).toBe("drawio");
    expect(diagram.legend.map((entry) => entry.color)).toEqual(["#d5e8d4", "#dae8fc", "#fff2cc", "#f8cecc"]);
    expect(parseDiagram(JSON.parse(JSON.stringify(diagram))).diagram.sections[0].look).toBe("drawio");
  });

  it("is set per tab, as one undo step, and carried into internal designs", () => {
    const store = useDiagramStore.getState;
    store().loadDiagram(createBlankDiagram());
    store().setSectionLook("drawio");
    expect(getActiveSection(store().diagram).look).toBe("drawio");
    store().addBlock({ x: 0, y: 0 });
    store().openDetail(store().selectedNodeIds[0]);
    expect(getActiveSection(store().diagram).look).toBe("drawio");
    store().closeDetail();
    store().undo();
    store().undo();
    expect(getActiveSection(store().diagram)).not.toHaveProperty("look");
  });
});

describe("draw.io-style flowchart editing", () => {
  const store = useDiagramStore.getState;
  const nodes = () => getActiveSection(store().diagram).nodes;
  const edges = () => getActiveSection(store().diagram).edges ?? [];

  it("adds a flowchart shape at its usual size, in the legend category named for it", () => {
    store().loadDiagram(flowchartTemplate.build());
    store().addBlock({ x: 900, y: 0 }, null, undefined, "decision");
    const added = nodes().at(-1)!;
    expect(added).toMatchObject({ size: { width: 160, height: 96 }, data: { shape: "decision", label: "Decision?", colorKey: "decision" } });
  });

  it("quick-adds the same shape off a side, lined up, clear of other boxes and connected", () => {
    store().loadDiagram(createBlankDiagram());
    store().addBlock({ x: 0, y: 0 });
    const first = store().selectedNodeIds[0];
    store().addConnectedBlock(first, "bottom");
    const second = nodes().at(-1)!;
    expect(second.position).toEqual({ x: 0, y: 56 + 60 });
    expect(edges()).toEqual([expect.objectContaining({ source: first, target: second.id, sourceSide: "bottom", targetSide: "top" })]);
    expect(store().selectedNodeIds).toEqual([second.id]);
    // Again from the first: the place below is taken, so it goes on past it.
    store().addConnectedBlock(first, "bottom");
    expect(nodes().at(-1)!.position.y).toBe(2 * (56 + 60));
    // One undo takes back one quick add, line and all.
    store().undo();
    expect(nodes()).toHaveLength(2);
    expect(edges()).toHaveLength(1);
  });

  it("labels the ways out of a decision Yes, then No", () => {
    store().loadDiagram(createBlankDiagram());
    store().addBlock({ x: 0, y: 0 }, null, undefined, "decision");
    const decision = store().selectedNodeIds[0];
    store().addConnectedBlock(decision, "bottom", "process");
    store().addConnectedBlock(decision, "right", "process");
    expect(edges().map((edge) => edge.label)).toEqual(["Yes", "No"]);
    expect(nodes().at(-1)!.data).not.toHaveProperty("shape");
  });
});

describe("flowchart shape colours and names", () => {
  it("gives a shape with no category of its own the step colour, and names a pill after a pill End", () => {
    const store = useDiagramStore.getState;
    store().loadDiagram(flowchartTemplate.build());
    store().addBlock({ x: 900, y: 0 }, null, undefined, "data");
    expect(getActiveSection(store().diagram).nodes.at(-1)!.data.colorKey).toBe("step");
    store().addBlock({ x: 900, y: 300 }, null, undefined, "terminal");
    store().addConnectedBlock(store().selectedNodeIds[0], "bottom");
    expect(getActiveSection(store().diagram).nodes.at(-1)!.data).toMatchObject({ label: "End", shape: "terminal" });
  });
});
