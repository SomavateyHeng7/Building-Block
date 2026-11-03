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
