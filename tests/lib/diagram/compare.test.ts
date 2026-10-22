import { beforeEach, describe, expect, it } from "vitest";
import { changeMarksForView, compareSections, comparisonRows, countChanges } from "@/lib/diagram/compare";
import { buildDiagram, type CanvasSpec } from "@/templates/build";
import { useDiagramStore } from "@/lib/diagram/store";
import { currentVsTargetTemplate } from "@/templates/current-vs-target";
import type { Diagram } from "@/lib/diagram/types";

const BASE: CanvasSpec = {
  columns: [
    [{ label: "Channels", components: [{ label: "Web", colorKey: "product" }] }],
    [
      {
        label: "Core",
        components: [
          { label: "CRM", colorKey: "replacement", technology: "On-premises" },
          { label: "Billing", colorKey: "product" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Web", to: "CRM", label: "Customers", protocol: "SOAP" },
    { from: "Web", to: "Billing", label: "Invoices", protocol: "REST" },
  ],
};

function twoTabs(target: CanvasSpec): Diagram {
  return buildDiagram("Plan", [
    { name: "Current", canvas: BASE },
    { name: "Target", canvas: target },
  ]);
}

const compare = (diagram: Diagram) => compareSections(diagram, diagram.sections[0], diagram.sections[1]);

describe("compareSections", () => {
  it("finds nothing between identical tabs, even with different ids", () => {
    const diagram = twoTabs(BASE);
    const result = compare(diagram);
    expect(result.nodes).toEqual([]);
    expect(result.connections).toEqual([]);
    expect(result.unchanged).toBe(5 + 2);
  });

  it("lists added, removed and changed components by name", () => {
    const diagram = twoTabs({
      columns: [
        [{ label: "Channels", components: [{ label: "web", colorKey: "product" }, { label: "App", colorKey: "new" }] }],
        [{ label: "Core", components: [{ label: "Billing", colorKey: "enhancement", owner: "Finance" }] }],
      ],
    });
    const result = compare(diagram);
    const summary = result.nodes.map((change) => [change.kind, change.label]);
    // "web" matches "Web": case and spacing don't make a different system.
    expect(summary).toEqual([
      ["added", "App"],
      ["removed", "CRM"],
      ["changed", "Billing"],
    ]);
    expect(result.nodes[2].fields).toEqual([
      { field: "Category", before: "Product Components", after: "Enhancement Components" },
      { field: "Owner", before: "", after: "Finance" },
    ]);
    // Added and changed point at the target tab, removed at the source.
    expect(result.nodes[0].sectionId).toBe(diagram.sections[1].id);
    expect(result.nodes[1].sectionId).toBe(diagram.sections[0].id);
    expect(countChanges(result)).toEqual({ added: 1, removed: 3, changed: 1 });
  });

  it("notices a component moving to another container", () => {
    const diagram = twoTabs({
      columns: [
        [{ label: "Channels", components: [{ label: "Web", colorKey: "product" }, { label: "Billing", colorKey: "product" }] }],
        [{ label: "Core", components: [{ label: "CRM", colorKey: "replacement", technology: "On-premises" }] }],
      ],
      connections: BASE.connections,
    });
    const result = compare(diagram);
    expect(result.nodes).toEqual([
      expect.objectContaining({ kind: "changed", label: "Billing", fields: [{ field: "Container", before: "Core", after: "Channels" }] }),
    ]);
  });

  it("ignores position and size", () => {
    const diagram = twoTabs(BASE);
    const target = diagram.sections[1];
    target.nodes = target.nodes.map((node) => ({ ...node, position: { x: node.position.x + 40, y: 0 }, size: { width: 999, height: 99 } }));
    expect(countChanges(compare(diagram))).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it("compares connections by their ends and what flows", () => {
    const diagram = twoTabs({
      ...BASE,
      connections: [
        { from: "Web", to: "CRM", label: "Customer data", protocol: "SOAP" },
        { from: "Web", to: "Billing", label: "Invoices", protocol: "Kafka", dashed: true },
        { from: "Billing", to: "CRM", label: "Accounts" },
      ],
    });
    const result = compare(diagram);
    expect(result.connections.map((change) => [change.kind, change.from, change.to, change.fields.map((field) => field.field)])).toEqual([
      ["added", "Billing", "CRM", []],
      ["changed", "Web", "Billing", ["Protocol", "Line"]],
      // Same ends, different label: a change of what flows, not a removal and an addition.
      ["changed", "Web", "CRM", ["What flows"]],
    ]);
  });

  it("treats a two-way connection the same whichever end it was drawn from", () => {
    const diagram = buildDiagram("Plan", [
      { name: "A", canvas: { ...BASE, connections: [{ from: "Web", to: "CRM", label: "Sync", both: true }] } },
      { name: "B", canvas: { ...BASE, connections: [{ from: "CRM", to: "Web", label: "Sync", both: true }] } },
    ]);
    expect(compare(diagram).connections).toEqual([]);
  });

  it("reports a changed internal design", () => {
    const detail: CanvasSpec = { columns: [[{ label: "Inside", components: [{ label: "Module", colorKey: "product" }] }]] };
    const withDetail = (spec: CanvasSpec): CanvasSpec => ({
      columns: [[{ label: "Core", components: [{ label: "CRM", colorKey: "product", detail: spec }] }]],
    });
    const same = buildDiagram("Plan", [
      { name: "A", canvas: withDetail(detail) },
      { name: "B", canvas: withDetail(detail) },
    ]);
    expect(compare(same).nodes).toEqual([]);

    const renamed = buildDiagram("Plan", [
      { name: "A", canvas: withDetail(detail) },
      { name: "B", canvas: withDetail({ columns: [[{ label: "Inside", components: [{ label: "Engine", colorKey: "product" }] }]] }) },
    ]);
    expect(compare(renamed).nodes[0].fields).toEqual([
      { field: "Internal design", before: "2 items", after: "2 items (changed)" },
    ]);
  });

  it("writes a change list with one row per changed field", () => {
    const diagram = twoTabs({
      columns: [
        [{ label: "Channels", components: [{ label: "Web", colorKey: "product" }] }],
        [{ label: "Core", components: [{ label: "CRM", colorKey: "replacement", technology: "Cloud" }, { label: "Billing", colorKey: "product" }] }],
      ],
      connections: [{ from: "Web", to: "CRM", label: "Customers", protocol: "SOAP" }],
    });
    expect(comparisonRows(compare(diagram))).toEqual([
      ["Change", "Type", "Name", "What changed", "Before", "After"],
      ["Changed", "Component", "CRM", "Technology", "On-premises", "Cloud"],
      ["Removed", "Connection", "Web → Billing (Invoices)", "", "", ""],
    ]);
  });

  it("notices a changed icon", () => {
    const diagram = twoTabs({
      ...BASE,
      columns: [
        BASE.columns[0],
        [{ label: "Core", components: [{ label: "CRM", colorKey: "replacement", technology: "On-premises", icon: "cloud" }, { label: "Billing", colorKey: "product" }] }],
      ],
    });
    expect(compare(diagram).nodes).toEqual([
      expect.objectContaining({ kind: "changed", label: "CRM", fields: [{ field: "Icon", before: "", after: "Cloud service" }] }),
    ]);
  });
});

describe("the current vs target template", () => {
  beforeEach(() => useDiagramStore.getState().loadDiagram(currentVsTargetTemplate.build()));

  it("has differences to show", () => {
    const diagram = useDiagramStore.getState().diagram;
    const counts = countChanges(compare(diagram));
    expect(counts.added).toBeGreaterThan(0);
    expect(counts.removed).toBeGreaterThan(0);
    expect(counts.changed).toBeGreaterThan(0);
  });
});

describe("changeMarksForView", () => {
  const target: CanvasSpec = {
    columns: [
      [{ label: "Channels", components: [{ label: "Web", colorKey: "product" }, { label: "App", colorKey: "new" }] }],
      [{ label: "Core", components: [{ label: "CRM", colorKey: "replacement", technology: "Cloud" }] }],
    ],
    connections: [{ from: "Web", to: "CRM", label: "Customers", protocol: "SOAP" }],
  };
  const diagram = twoTabs(target);
  const [current, next] = diagram.sections;
  const pair = { diagramId: diagram.id, fromId: current.id, toId: next.id };
  const idOf = (section: typeof current, label: string) => section.nodes.find((node) => node.data.label === label)!.id;

  it("marks additions and changes on the 'to' tab, with a legend for what appears", () => {
    const marks = changeMarksForView(diagram, pair, next)!;
    expect([...marks.nodes]).toEqual([
      [idOf(next, "App"), "added"],
      [idOf(next, "CRM"), "changed"],
    ]);
    expect(marks.edges.size).toBe(0);
    expect(marks.legend.map((entry) => entry.label)).toEqual(["Added since Current", "Changed since Current"]);
  });

  it("marks removals on the 'from' tab, where they still are", () => {
    const marks = changeMarksForView(diagram, pair, current)!;
    expect([...marks.nodes]).toEqual([[idOf(current, "Billing"), "removed"]]);
    expect([...marks.edges.values()]).toEqual(["removed"]);
    expect(marks.legend.map((entry) => entry.label)).toEqual(["Removed in Target"]);
  });

  it("marks nothing elsewhere, or for another diagram", () => {
    expect(changeMarksForView(diagram, null, next)).toBeNull();
    expect(changeMarksForView(diagram, { ...pair, diagramId: "other" }, next)).toBeNull();
    expect(changeMarksForView(diagram, pair, { id: `${next.id}/x`, parent: {} })).toBeNull();
  });
});
