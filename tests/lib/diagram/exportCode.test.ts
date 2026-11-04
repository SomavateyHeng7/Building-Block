import { describe, expect, it } from "vitest";
import { codeForView } from "@/lib/diagram/exportCode";
import { exportViews, planExport } from "@/lib/diagram/exportPlan";
import { createBlankDiagram, createBlankSection } from "@/lib/diagram/factory";
import type { Diagram, DiagramNode } from "@/lib/diagram/types";

const block = (id: string, label: string, extra: Partial<DiagramNode["data"]> = {}, parentId?: string): DiagramNode => ({
  id,
  type: "block",
  position: { x: 0, y: 0 },
  size: { width: 100, height: 50 },
  ...(parentId ? { parentId } : {}),
  data: { kind: "block", label, containerId: parentId ?? null, ...extra } as DiagramNode["data"],
});
const container = (id: string, label: string): DiagramNode => ({
  id,
  type: "container",
  position: { x: 0, y: 0 },
  size: { width: 300, height: 200 },
  data: { kind: "container", label },
});

function sample(): Diagram {
  const diagram = createBlankDiagram("Shop");
  diagram.sections[0] = {
    ...diagram.sections[0],
    name: "Current",
    nodes: [
      container("c", 'Back "office"'),
      block("a", "Web", { technology: "React" }, "c"),
      block("b", "Orders\nAPI", { description: "Takes orders" }, "c"),
      block("x", "Payments (3rd party)"),
    ],
    edges: [
      { id: "e1", source: "a", target: "b", label: "Place order", protocol: "REST" },
      { id: "e2", source: "b", target: "x", protocol: "Kafka", style: "dashed", direction: "both" },
      { id: "e3", source: "b", target: "gone" },
    ],
  };
  return diagram;
}

const viewOf = (diagram: Diagram, index = 0) => exportViews(diagram)[index];

describe("Mermaid flowchart", () => {
  it("writes containers as subgraphs, components as boxes and connections with their caption and line", () => {
    const diagram = sample();
    const code = codeForView(diagram, viewOf(diagram), "mermaid")!;
    expect(code).toContain("flowchart LR");
    expect(code).toContain('subgraph n1["Back #quot;office#quot;"]');
    expect(code).toContain('n2["Web<br/>[React]"]');
    expect(code).toContain('n3["Orders API"]');
    expect(code).toContain('n4["Payments (3rd party)"]');
    expect(code).toContain('n2 -->|"Place order (REST)"| n3');
    expect(code).toContain('n3 <-.->|"Kafka"| n4');
  });

  it("leaves out connections to something that isn't there", () => {
    const diagram = sample();
    const code = codeForView(diagram, viewOf(diagram), "mermaid")!;
    expect(code).not.toContain("gone");
    expect((code.match(/-->|<-\.->/g) ?? []).length).toBe(2);
  });

  it("writes a sequence tab as sequence code", () => {
    const diagram = sample();
    diagram.sections.push({ ...createBlankSection("Login", "sequence"), sequence: { participants: [{ id: "p", label: "User" }, { id: "q", label: "App" }], steps: [{ id: "s", type: "message", from: "p", to: "q", label: "Sign in" }] } });
    expect(codeForView(diagram, viewOf(diagram, 1), "mermaid")).toMatch(/^sequenceDiagram/);
  });
});

describe("C4-PlantUML", () => {
  it("writes boundaries, containers and relationships", () => {
    const diagram = sample();
    const code = codeForView(diagram, viewOf(diagram), "plantuml")!;
    expect(code.startsWith("@startuml\n!include <C4/C4_Container>")).toBe(true);
    expect(code).toContain("Boundary(n1, \"Back 'office'\") {");
    expect(code).toContain('Container(n2, "Web", "React", "")');
    expect(code).toContain('Rel(n2, n3, "Place order", "REST")');
    expect(code).toContain('BiRel(n3, n4, "", "Kafka")');
    expect(code.trimEnd().endsWith("@enduml")).toBe(true);
  });

  it("has nothing to say about a sequence tab", () => {
    const diagram = sample();
    diagram.sections.push({ ...createBlankSection("Login", "sequence"), sequence: { participants: [{ id: "p", label: "User" }], steps: [] } });
    expect(codeForView(diagram, viewOf(diagram, 1), "plantuml")).toBeNull();
  });
});

describe("planning code files", () => {
  it("makes one file per view, skipping PlantUML for sequence tabs", () => {
    const diagram = sample();
    diagram.sections.push({ ...createBlankSection("Login", "sequence"), sequence: { participants: [{ id: "p", label: "User" }], steps: [] } });
    const views = exportViews(diagram);
    const names = (formats: ("mermaid" | "plantuml")[]) => planExport(diagram, { views, formats, bundle: "separate" }).files.map((file) => file.name);
    expect(names(["mermaid"])).toEqual(["shop-current.mmd", "shop-login.mmd"]);
    expect(names(["plantuml"])).toEqual(["shop-current.puml"]);
  });
});
