import { describe, expect, it } from "vitest";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { describeFiles, exportViews, planExport } from "@/lib/diagram/exportPlan";
import type { Diagram, DiagramNode } from "@/lib/diagram/types";

function block(id: string, label: string, detail?: DiagramNode[]): DiagramNode {
  return {
    id,
    type: "block",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 40 },
    data: { kind: "block", label, containerId: null, ...(detail ? { detail: { nodes: detail } } : {}) },
  };
}

/** "Plan" with tabs Current (Orders, with an internal design) and Target, plus an empty tab. */
function plan(): Diagram {
  const diagram = createBlankDiagram("Plan");
  diagram.sections = [
    { id: "s1", name: "Current", nodes: [block("orders", "Orders", [block("api", "API")]), block("pay", "Payments")] },
    { id: "s2", name: "Target", nodes: [block("orders2", "Orders")] },
    { id: "s3", name: "Ideas", nodes: [] },
  ];
  diagram.activeSectionId = "s1";
  return diagram;
}

const names = (result: ReturnType<typeof planExport>) => result.files.map((file) => file.name);

describe("exportViews", () => {
  it("lists each tab followed by its internal designs, with file names", () => {
    expect(exportViews(plan()).map((view) => [view.id, view.stem, view.nodeCount])).toEqual([
      ["s1", "plan-current", 2],
      ["s1/orders", "plan-current-orders-internal", 1],
      ["s2", "plan-target", 1],
      ["s3", "plan-ideas", 0],
    ]);
  });
});

describe("planExport", () => {
  const diagram = plan();
  const views = exportViews(diagram);
  const all = views;

  it("gives a single file for one view in one format, never a zip", () => {
    const result = planExport(diagram, { views: [views[0]], formats: ["png"], bundle: "one" });
    expect(names(result)).toEqual(["plan-current.png"]);
    expect(result.zipName).toBeUndefined();
  });

  it("puts every view in one PDF when bundled, and one PDF per view when separate", () => {
    expect(names(planExport(diagram, { views: all, formats: ["pdf"], bundle: "one" }))).toEqual(["plan.pdf"]);
    expect(planExport(diagram, { views: all, formats: ["pdf"], bundle: "one" }).zipName).toBeUndefined();
    // The interactive viewer follows the PDF: one page with a tab per view, or one per view.
    expect(names(planExport(diagram, { views: all, formats: ["html"], bundle: "one" }))).toEqual(["plan.html"]);
    expect(names(planExport(diagram, { views: all, formats: ["html"], bundle: "separate" }))[0]).toBe("plan-current.html");
    expect(names(planExport(diagram, { views: all, formats: ["pdf"], bundle: "separate" }))).toEqual([
      "plan-current.pdf",
      "plan-current-orders-internal.pdf",
      "plan-target.pdf",
    ]);
  });

  it("skips empty views", () => {
    expect(names(planExport(diagram, { views: [views[3]], formats: ["png"], bundle: "one" }))).toEqual([]);
  });

  it("zips several files when bundled, and downloads them one by one when separate", () => {
    const choice = { views: [views[0], views[2]], formats: ["png", "components-csv", "json"] as const };
    const one = planExport(diagram, { ...choice, formats: [...choice.formats], bundle: "one" });
    expect(one.zipName).toBe("plan.zip");
    expect(names(one)).toEqual(["plan-current.png", "plan-target.png", "plan-components.csv", "plan.json"]);
    const separate = planExport(diagram, { ...choice, formats: [...choice.formats], bundle: "separate" });
    expect(separate.zipName).toBeUndefined();
    expect(separate.files).toHaveLength(4);
  });

  it("covers the whole diagram with lists, whatever views are picked", () => {
    expect(names(planExport(diagram, { views: [], formats: ["connections-csv"], bundle: "one" }))).toEqual(["plan-connections.csv"]);
  });

  it("numbers files that would share a name", () => {
    const twins = plan();
    twins.sections[1].name = "Current";
    const result = planExport(twins, { views: exportViews(twins), formats: ["png"], bundle: "separate" });
    expect(names(result)).toEqual(["plan-current.png", "plan-current-orders-internal.png", "plan-current-2.png"]);
  });

  it("describes what's in an export", () => {
    const result = planExport(diagram, { views: all, formats: ["png", "pdf", "components-csv"], bundle: "one" });
    expect(describeFiles(result.files)).toBe("3 PNG images, 1 PDF and the component list");
  });
});
