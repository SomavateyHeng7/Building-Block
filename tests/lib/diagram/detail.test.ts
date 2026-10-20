import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { isDirty, startDiagram, useFileStore } from "@/lib/diagram/file";
import { componentRows, connectionRows, exportTitle } from "@/lib/diagram/export";
import { everyNode, getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { parseDiagram } from "@/lib/diagram/validate";

const store = () => useDiagramStore.getState();
const view = () => getActiveSection(store().diagram);

/** Adds a component to the view on screen and returns its id. */
function addBlock(x = 0, y = 0) {
  store().addBlock({ x, y });
  return store().selectedNodeIds[0];
}

beforeEach(() => {
  vi.stubGlobal("window", {});
  useFileStore.setState({ opened: false, handle: null, fileName: null, saved: null, saving: false, error: false });
  store().loadDiagram(createBlankDiagram());
});

describe("internal designs (L2)", () => {
  it("draws inside the open component, leaving the tab's own canvas alone", () => {
    const orders = addBlock();
    store().openDetail(orders);
    expect(view().parent?.component.id).toBe(orders);
    expect(view().nodes).toEqual([]);

    const api = addBlock(0, 0);
    const db = addBlock(200, 0);
    expect(store().addConnection({ source: api, target: db })).not.toBeNull();

    const section = store().diagram.sections[0];
    expect(section.nodes.map((node) => node.id)).toEqual([orders]);
    const detail = section.nodes[0].data.kind === "block" ? section.nodes[0].data.detail : undefined;
    expect(detail?.nodes.map((node) => node.id)).toEqual([api, db]);
    expect(detail?.edges).toHaveLength(1);
  });

  it("goes back to the tab with the component selected", () => {
    const orders = addBlock();
    store().openDetail(orders);
    store().closeDetail();
    expect(view().parent).toBeUndefined();
    expect(store().selectedNodeIds).toEqual([orders]);
  });

  it("treats opening and closing as navigation: no undo step, nothing unsaved", () => {
    const diagram = createBlankDiagram();
    diagram.sections[0].nodes.push({
      id: "orders",
      type: "block",
      position: { x: 0, y: 0 },
      size: { width: 140, height: 56 },
      data: { kind: "block", label: "Orders", containerId: null },
    });
    startDiagram(diagram, { handle: null, fileName: "plan.json" });
    store().openDetail("orders");
    expect(store().past).toHaveLength(0);
    expect(isDirty()).toBe(false);
    addBlock();
    expect(isDirty()).toBe(true);
  });

  it("undoes edits made inside an internal design", () => {
    const orders = addBlock();
    store().openDetail(orders);
    addBlock();
    expect(view().nodes).toHaveLength(1);
    store().undo();
    expect(view().nodes).toHaveLength(0);
    expect(view().parent?.component.id).toBe(orders);
  });

  it("drops an internal design once everything in it is deleted", () => {
    const orders = addBlock();
    store().openDetail(orders);
    const inside = addBlock();
    store().deleteNodes([inside]);
    const component = store().diagram.sections[0].nodes[0];
    expect(component.data.kind === "block" && "detail" in component.data && component.data.detail).toBeFalsy();
  });

  it("is one level deep: components can't be opened from inside, and pasted ones lose theirs", () => {
    const orders = addBlock();
    store().openDetail(orders);
    addBlock();
    store().closeDetail();

    // Copy the L1 component (with its internal design) and paste it inside another component.
    store().setSelection([orders]);
    store().copySelection();
    const payments = addBlock(300, 0);
    store().openDetail(payments);
    store().paste();
    const pasted = view().nodes[0];
    expect(pasted.data.kind === "block" && pasted.data.detail).toBeFalsy();

    store().openDetail(pasted.id);
    expect(view().parent?.component.id).toBe(payments);
  });

  it("keeps a component's internal design when it is copied on its tab", () => {
    const orders = addBlock();
    store().openDetail(orders);
    addBlock();
    store().closeDetail();
    store().setSelection([orders]);
    store().duplicateSelection();
    const copy = store().diagram.sections[0].nodes[1];
    expect(copy.data.kind === "block" && copy.data.detail?.nodes).toHaveLength(1);
  });

  it("leaves the internal design when switching tabs", () => {
    const orders = addBlock();
    store().openDetail(orders);
    store().addSection();
    store().setActiveSection(store().diagram.sections[0].id);
    expect(view().parent).toBeUndefined();
  });

  it("unassigns a removed legend entry inside internal designs too", () => {
    const key = store().diagram.legend[0].key;
    const orders = addBlock();
    store().openDetail(orders);
    addBlock();
    expect(view().nodes[0].data.colorKey).toBe(key);
    store().removeLegendEntry(key);
    expect(everyNode(store().diagram).some((node) => node.data.colorKey === key)).toBe(false);
  });

  it("returns the same view object while nothing changes, so selectors stay stable", () => {
    const orders = addBlock();
    store().openDetail(orders);
    expect(getActiveSection(store().diagram)).toBe(getActiveSection(store().diagram));
  });
});

describe("internal designs in files and exports", () => {
  function diagramWithDetail() {
    const orders = addBlock();
    store().updateNodeLabel(orders, "Orders");
    store().openDetail(orders);
    const api = addBlock();
    store().updateNodeLabel(api, "Orders API");
    const db = addBlock(200, 0);
    store().updateNodeLabel(db, "Orders DB");
    store().addConnection({ source: api, target: db });
    return store().diagram;
  }

  it("round-trips through a file, reopening the design that was open", () => {
    const saved = diagramWithDetail();
    const { diagram, fixes } = parseDiagram(JSON.parse(JSON.stringify(saved)));
    expect(fixes).toEqual([]);
    expect(diagram.activeDetailId).toBe(saved.activeDetailId);
    expect(getActiveSection(diagram).nodes.map((node) => node.data.label)).toEqual(["Orders API", "Orders DB"]);
  });

  it("removes internal designs nested inside internal designs, and says so", () => {
    const saved = JSON.parse(JSON.stringify(diagramWithDetail()));
    saved.sections[0].nodes[0].data.detail.nodes[0].data.detail = { nodes: [] };
    const { diagram, fixes } = parseDiagram(saved);
    const inside = diagram.sections[0].nodes[0].data.kind === "block" ? diagram.sections[0].nodes[0].data.detail : undefined;
    expect(inside?.nodes[0].data.detail).toBeUndefined();
    expect(fixes.join()).toMatch(/nested inside an internal design/);
  });

  it("lists internal components and connections with the component they are part of", () => {
    const diagram = diagramWithDetail();
    expect(componentRows(diagram).slice(1).map((row) => [row[1], row[3]])).toEqual([
      ["", "Orders"],
      ["Orders", "Orders API"],
      ["Orders", "Orders DB"],
    ]);
    expect(connectionRows(diagram).slice(1).map((row) => row.slice(1, 4))).toEqual([["Orders", "Orders API", "Orders DB"]]);
  });

  it("titles an internal design's image with its tab and component", () => {
    const diagram = diagramWithDetail();
    expect(exportTitle(diagram, getActiveSection(diagram))).toBe("Untitled Diagram — Section 1 — Orders (internal design)");
  });
});
