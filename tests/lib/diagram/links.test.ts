import { describe, expect, it } from "vitest";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { componentRows } from "@/lib/diagram/export";
import { parseDiagram } from "@/lib/diagram/validate";
import { safeWebAddress } from "@/lib/diagram/webAddress";
import type { DiagramNode } from "@/lib/diagram/types";

describe("safeWebAddress", () => {
  it("accepts http and https addresses only", () => {
    expect(safeWebAddress(" https://wiki.example.com/adr/12 ")).toBe("https://wiki.example.com/adr/12");
    expect(safeWebAddress("http://example.com")).toBe("http://example.com/");
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd", "wiki.example.com", "", "   ", undefined]) {
      expect(safeWebAddress(bad)).toBeNull();
    }
    expect(safeWebAddress(`https://example.com/${"a".repeat(2100)}`)).toBeNull();
  });
});

describe("links on components", () => {
  const block = (link: string): DiagramNode => ({
    id: "a",
    type: "block",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 50 },
    data: { kind: "block", label: "Web", containerId: null, link },
  });
  const diagramWith = (link: string) => {
    const diagram = createBlankDiagram();
    diagram.sections[0] = { ...diagram.sections[0], nodes: [block(link)] };
    return diagram;
  };

  it("keeps a web address through a file, and drops anything else", () => {
    const kept = parseDiagram(JSON.parse(JSON.stringify(diagramWith("https://wiki.example.com/adr/12")))).diagram;
    expect(kept.sections[0].nodes[0].data.link).toBe("https://wiki.example.com/adr/12");
    const dropped = parseDiagram(JSON.parse(JSON.stringify(diagramWith("javascript:alert(1)")))).diagram;
    expect(dropped.sections[0].nodes[0].data.link).toBeUndefined();
  });

  it("goes into the component list", () => {
    const rows = componentRows(diagramWith("https://wiki.example.com/adr/12"));
    expect(rows[0].at(-1)).toBe("Link");
    expect(rows[1].at(-1)).toBe("https://wiki.example.com/adr/12");
  });
});
