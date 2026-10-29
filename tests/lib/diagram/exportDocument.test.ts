import { describe, expect, it } from "vitest";
import { solutionDocument } from "@/lib/diagram/exportDocument";
import { exportViews, planExport } from "@/lib/diagram/exportPlan";
import { createBlankDiagram, createBlankSection } from "@/lib/diagram/factory";
import type { Diagram, DiagramNode } from "@/lib/diagram/types";

const block = (id: string, label: string, data: Record<string, unknown> = {}, parentId?: string): DiagramNode =>
  ({
    id,
    type: "block",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 50 },
    ...(parentId ? { parentId } : {}),
    data: { kind: "block", label, containerId: parentId ?? null, ...data },
  }) as DiagramNode;

function sample(): Diagram {
  const diagram = createBlankDiagram("Shop | Platform");
  const orders = block("b", "Orders", {
    technology: "Java",
    owner: "Team B",
    description: "Takes <orders>\nfrom the web",
    notes: "Retries are manual.",
    link: "https://wiki.example.com/adr/12",
    detail: { nodes: [block("q", "Queue"), block("w", "Worker")], edges: [{ id: "ie", source: "q", target: "w", protocol: "AMQP" }] },
  });
  diagram.sections[0] = {
    ...diagram.sections[0],
    name: "Current",
    nodes: [
      { id: "c", type: "container", position: { x: 0, y: 0 }, size: { width: 300, height: 200 }, data: { kind: "container", label: "Back office" } },
      block("a", "Web", { colorKey: diagram.legend[0].key }),
      { ...orders, parentId: "c" },
    ],
    edges: [{ id: "e", source: "a", target: "b", label: "Place order", protocol: "REST" }],
  };
  diagram.comments = [
    { id: "1", targetId: "a", author: "Sam", text: "Why this vendor?", createdAt: "2026-10-29T10:00:00.000Z" },
    { id: "2", targetId: "e", author: "Lee", text: "Add a retry policy", createdAt: "2026-10-30T09:00:00.000Z" },
    { id: "3", targetId: "b", author: "Sam", text: "Done already", createdAt: "2026-10-29T10:00:00.000Z", resolved: true },
  ];
  return diagram;
}

describe("solutionDocument", () => {
  const doc = solutionDocument(sample(), { date: "2026-10-30" });

  it("starts with the diagram's name, safe in a heading, and a dated line", () => {
    expect(doc.startsWith("# Shop \\| Platform\n\n_Generated from Building Block on 2026-10-30._\n")).toBe(true);
  });

  it("lists components with their details, keeping tables intact", () => {
    expect(doc).toContain("## Current");
    expect(doc).toContain("| Orders | Component | Back office |");
    expect(doc).toContain("Takes &lt;orders&gt;<br>from the web");
    expect(doc).toContain("[https://wiki.example.com/adr/12](https://wiki.example.com/adr/12)");
    expect(doc).toContain("- **Orders:** Retries are manual.");
  });

  it("lists connections and internal designs", () => {
    expect(doc).toContain("| Web | → | Orders | Place order | REST |");
    expect(doc).toContain("### Internal design: Orders");
    expect(doc).toContain("| Queue | → | Worker |  | AMQP |");
  });

  it("closes with the legend and only the open comments", () => {
    expect(doc).toContain("## Legend");
    expect(doc).toContain("## Open review comments (2)");
    expect(doc).toContain("- **Web** — Sam, 2026-10-29: Why this vendor?");
    expect(doc).toContain("- **Web → Orders** — Lee, 2026-10-30: Add a retry policy");
    expect(doc).not.toContain("Done already");
  });

  it("links the pictures that are exported with it, and only those", () => {
    const diagram = sample();
    const views = exportViews(diagram);
    const withPicture = solutionDocument(diagram, { images: new Map([[views[0].id, "shop-current.png"]]) });
    expect(withPicture).toContain("![Current](shop-current.png)");
    expect(doc).not.toContain("![");
  });

  it("writes a sequence tab as Mermaid code, and lists checkpoints", () => {
    const diagram = sample();
    diagram.sections.push({ ...createBlankSection("Login", "sequence"), sequence: { participants: [{ id: "p", label: "User" }, { id: "q", label: "App" }], steps: [{ id: "s", type: "message", from: "p", to: "q", label: "Sign in" }] } });
    diagram.checkpoints = [{ id: "k", name: "Approved", createdAt: "2026-10-01T00:00:00Z", snapshot: { name: "x", legend: [], sections: [diagram.sections[0]] } }];
    const text = solutionDocument(diagram);
    expect(text).toContain("```mermaid\nsequenceDiagram");
    expect(text).toContain("## Version history");
    expect(text).toContain("- **Approved** — 2026-10-01 (1 tab)");
  });

  it("is planned as one file for the whole diagram", () => {
    const diagram = sample();
    const plan = planExport(diagram, { views: exportViews(diagram), formats: ["document", "png"], bundle: "one" });
    expect(plan.files.map((file) => file.name)).toEqual(["shop-platform-document.md", "shop-platform.png", "shop-platform-orders-internal.png"]);
    expect(plan.zipName).toBe("shop-platform.zip");
  });
});
