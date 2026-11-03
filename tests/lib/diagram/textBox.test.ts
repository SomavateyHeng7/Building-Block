import { beforeEach, describe, expect, it } from "vitest";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { parseDiagram } from "@/lib/diagram/validate";
import { componentRows } from "@/lib/diagram/export";

const store = () => useDiagramStore.getState();
const nodes = () => getActiveSection(store().diagram).nodes;

describe("text boxes", () => {
  beforeEach(() => store().loadDiagram(createBlankDiagram()));

  it("adds a selected text box that keeps line breaks and style", () => {
    store().addText({ x: 10, y: 20 });
    const [text] = nodes();
    expect(text).toMatchObject({ type: "text", position: { x: 10, y: 20 }, data: { kind: "text", label: "Text" } });
    expect(store().selectedNodeIds).toEqual([text.id]);
    store().updateNodeLabel(text.id, "Line one\nLine two");
    store().updateTextStyle(text.id, { fontSize: 24, bold: true, align: "center" });
    expect(nodes()[0].data).toMatchObject({ label: "Line one\nLine two", fontSize: 24, bold: true, align: "center" });
    store().updateTextStyle(text.id, { bold: undefined });
    expect(nodes()[0].data).not.toHaveProperty("bold");
  });

  it("round-trips through a saved file", () => {
    store().addText({ x: 10, y: 20 }, "Payments domain\nOwned by Team A");
    store().updateTextStyle(store().selectedNodeIds[0], { fontSize: 20, align: "right" });
    const { diagram, fixes } = parseDiagram(JSON.parse(JSON.stringify(store().diagram)));
    expect(fixes).toEqual([]);
    expect(diagram.sections[0].nodes[0]).toMatchObject({
      type: "text",
      data: { kind: "text", label: "Payments domain\nOwned by Team A", fontSize: 20, align: "right" },
    });
  });

  it("can't be connected and isn't listed as a component", () => {
    store().addText({ x: 0, y: 0 });
    const text = store().selectedNodeIds[0];
    store().addBlock({ x: 300, y: 0 });
    const block = store().selectedNodeIds[0];
    expect(store().addConnection({ source: text, target: block })).toBeNull();
    expect(componentRows(store().diagram).slice(1).map((row) => row[2])).toEqual(["Component"]);
  });
});

describe("setNodeGeometry", () => {
  beforeEach(() => store().loadDiagram(createBlankDiagram()));

  it("moves and resizes to whole pixels, within the minimum size", () => {
    store().addBlock({ x: 0, y: 0 });
    const id = store().selectedNodeIds[0];
    store().setNodeGeometry(id, { x: 13.4, y: 7, width: 151 });
    expect(nodes()[0]).toMatchObject({ position: { x: 13, y: 7 }, size: { width: 151, height: 56 } });
    store().setNodeGeometry(id, { height: 1 });
    expect(nodes()[0].size.height).toBe(32);
  });

  it("grows the container when a component is moved past its edge", () => {
    store().addContainer({ x: 0, y: 0 });
    const container = store().selectedNodeIds[0];
    store().addBlock({ x: 16, y: 40 }, container);
    store().setNodeGeometry(store().selectedNodeIds[0], { x: 400 });
    expect(nodes().find((node) => node.id === container)!.size.width).toBeGreaterThanOrEqual(400 + 140);
  });
});
