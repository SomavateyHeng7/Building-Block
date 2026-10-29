import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ImportError, diagramFromImport, importDiagramText, isImportable } from "@/lib/diagram/importFile";
import { parseMermaidSequence } from "@/lib/diagram/importMermaid";
import { parseDrawio, plainLabel } from "@/lib/diagram/importDrawio";
import { absolutePosition, CONTAINER_HEADER } from "@/lib/diagram/layout";
import { readSequenceCode } from "@/lib/diagram/exportMermaid";
import { findAll, parseXml } from "@/lib/diagram/xml";
import type { DiagramNode, SequenceMessage } from "@/lib/diagram/types";

const MODEL = `<mxGraphModel><root>
  <mxCell id="0"/>
  <mxCell id="1" parent="0"/>
  <mxCell id="lane" value="Core &lt;b&gt;Systems&lt;/b&gt;" style="swimlane;strokeColor=#6C8EBF;dashed=1;" vertex="1" parent="1">
    <mxGeometry x="100" y="50" width="300" height="200" as="geometry"/>
  </mxCell>
  <mxCell id="orders" value="Orders" style="rounded=1;fillColor=#dae8fc;" vertex="1" parent="lane">
    <mxGeometry x="20" y="10" width="120" height="60" as="geometry"/>
  </mxCell>
  <object id="pay" label="Payments&lt;br&gt;API" tooltip="Takes card payments">
    <mxCell style="fillColor=#DAE8FC;" vertex="1" parent="1"><mxGeometry x="600" y="80" width="120" height="60" as="geometry"/></mxCell>
  </object>
  <mxCell id="free" value="Just a caption" style="text;html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="80" height="20" as="geometry"/></mxCell>
  <mxCell id="e1" value="" style="edgeStyle=orthogonalEdgeStyle;dashed=1;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" parent="1" source="orders" target="pay">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>
  <mxCell id="e1label" value="Charge" style="edgeLabel;" vertex="1" connectable="0" parent="e1"><mxGeometry relative="1" as="geometry"/></mxCell>
  <mxCell id="e2" style="startArrow=classic;endArrow=none;" edge="1" parent="1" source="orders" target="pay"><mxGeometry relative="1" as="geometry"/></mxCell>
  <mxCell id="loose" edge="1" parent="1" source="orders"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel>`;

const find = (nodes: DiagramNode[], label: string) => nodes.find((node) => node.data.label === label)!;

describe("reading XML", () => {
  it("reads attributes (with > inside quotes), entities, text and CDATA, and skips comments", () => {
    const root = parseXml(`<?xml version="1.0"?><!-- hi --><a x="1 &gt; 0" y='&#65;'><b/>t&amp;x<![CDATA[<raw>]]></a>`);
    expect(root.attributes).toEqual({ x: "1 > 0", y: "A" });
    expect(root.children.map((child) => child.name)).toEqual(["b"]);
    expect(root.text).toBe("t&x<raw>");
  });

  it("keeps the text of draw.io's HTML labels", () => {
    expect(plainLabel("Core <b>Systems</b><br>v2&nbsp;")).toBe("Core Systems v2");
  });

  it("keeps character codes past Unicode as written, and finds elements nested deeper than the stack", () => {
    expect(parseXml(`<a x="&#99999999;&#x110000;&#65;"/>`).attributes.x).toBe("&#99999999;&#x110000;A");
    expect(plainLabel("x &#99999999; y")).toBe("x &#99999999; y");
    const depth = 200_000;
    const deep = parseXml(`<r>${"<a>".repeat(depth)}<b/>${"</a>".repeat(depth)}<b/></r>`);
    expect(findAll(deep, "b")).toHaveLength(2);
  });
});

describe("importing draw.io", () => {
  it("turns shapes, swimlanes and arrows into components, containers and connections", async () => {
    const { sections, legend, fixes } = await parseDrawio(MODEL);
    const { nodes, edges = [] } = sections[0];
    const lane = find(nodes, "Core Systems");
    const orders = find(nodes, "Orders");
    const pay = find(nodes, "Payments API");

    expect(lane).toMatchObject({ type: "container", position: { x: 100, y: 50 }, data: { outlineColor: "#6c8ebf", outlineStyle: "dashed" } });
    // Inside the container, moved clear of its header.
    expect(orders.parentId).toBe(lane.id);
    expect(orders.position).toEqual({ x: 20, y: CONTAINER_HEADER });
    expect(absolutePosition(pay, nodes)).toEqual({ x: 600, y: 80 });
    expect(pay.data.description).toBe("Takes card payments");

    // One category for the colour, whatever its case.
    expect(legend).toEqual([{ key: expect.any(String), label: "Imported #dae8fc", color: "#dae8fc" }]);
    expect(orders.data.colorKey).toBe(legend[0].key);
    expect(pay.data.colorKey).toBe(legend[0].key);

    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({ source: orders.id, target: pay.id, label: "Charge", style: "dashed", shape: "step", sourceSide: "right", targetSide: "left" });
    // An arrowhead only at the start points the other way.
    expect(edges[1]).toMatchObject({ source: pay.id, target: orders.id, shape: "straight" });
    expect(fixes.join(" ")).toMatch(/1 free text label/);
    expect(fixes.join(" ")).toMatch(/1 arrow that didn't join two shapes/);
  });

  it("lays out a container's components in a grid when they overlap, and leaves tidy ones alone", async () => {
    const lane = `<mxCell id="lane" value="Core" style="swimlane;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="500" height="300" as="geometry"/></mxCell>`;
    const cell = (id: string, x: number) =>
      `<mxCell id="${id}" value="${id}" vertex="1" parent="lane"><mxGeometry x="${x}" y="50" width="120" height="60" as="geometry"/></mxCell>`;
    const wrap = (cells: string) => `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${lane}${cells}</root></mxGraphModel>`;

    const piled = await parseDrawio(wrap(cell("A", 20) + cell("B", 40)));
    const [a, b] = ["A", "B"].map((label) => find(piled.sections[0].nodes, label));
    expect(a.position).not.toEqual(b.position);
    expect(piled.fixes.join(" ")).toMatch(/Rearranged the components in 1 container/);

    const apart = await parseDrawio(wrap(cell("A", 20) + cell("B", 200)));
    expect(find(apart.sections[0].nodes, "B").position.x).toBe(200);
    expect(apart.fixes.join(" ")).not.toMatch(/Rearranged/);
  });

  it("reads compressed pages, one tab each, and reuses imported categories already in the legend", async () => {
    const compressed = (xml: string) => deflateRawSync(Buffer.from(encodeURIComponent(xml))).toString("base64");
    const file = `<mxfile><diagram name="Current">${compressed(MODEL)}</diagram><diagram name="Target"><![CDATA[]]>${MODEL}</diagram></mxfile>`;
    const existing = [{ key: "earlier", label: "Imported #dae8fc", color: "#DAE8FC" }];
    const { sections, legend } = await parseDrawio(file, existing);
    expect(sections.map((section) => section.name)).toEqual(["Current", "Target"]);
    expect(legend).toEqual([]);
    expect(find(sections[0].nodes, "Orders").data.colorKey).toBe("earlier");
  });

  it("says what's wrong with files it can't use", async () => {
    await expect(parseDrawio("<svg></svg>")).rejects.toThrow(/isn't a draw.io file/);
    await expect(parseDrawio("<mxGraphModel><root><mxCell id='0'/></root></mxGraphModel>")).rejects.toThrow(/no shapes/);
  });

  it("imports shapes whose parents loop or nest very deep", async () => {
    const shape = (id: string, parent: string, style = "") =>
      `<mxCell id="${id}" value="${id}" style="${style}" vertex="1" parent="${parent}"><mxGeometry x="10" y="10" width="80" height="40" as="geometry"/></mxCell>`;
    const model = (cells: string) => `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;

    const self = await parseDrawio(model(shape("Self", "Self")));
    expect(find(self.sections[0].nodes, "Self").position).toEqual({ x: 10, y: 10 });
    const loop = await parseDrawio(model(shape("A", "B") + shape("B", "A") + shape("G", "H", "group") + shape("H", "G", "group") + shape("C", "G")));
    expect(loop.sections[0].nodes.map((node) => node.data.label).sort()).toEqual(["A", "B", "C"]);

    const chain = Array.from({ length: 20_000 }, (_, index) => shape(`n${index}`, index ? `n${index - 1}` : "1", "group")).join("");
    const deep = await importDiagramText(model(chain + shape("Leaf", "n19999")));
    expect(find(deep.sections[0].nodes, "Leaf")).toBeDefined();
  });
});

describe("importing Mermaid", () => {
  const SOURCE = `
%% a comment
sequenceDiagram
  title Checkout
  autonumber
  actor C as Customer
  participant W as "Web Shop"
  C->>W: Place order
  W->>+O: Create order<br/>now
  loop Every item
    O->>O: Check stock
  end
  alt paid
    O-)Q: OrderPlaced
  else failed
    O-->>W: Error
  end
  Note over W,O: Retries twice
  Note right of C: Waits
  O-->>-W: 42
  this line is nonsense
`;

  it("reads participants, aliases, every kind of message and notes, flattening blocks", () => {
    const { sequence, title, fixes } = parseMermaidSequence(SOURCE);
    expect(title).toBe("Checkout");
    expect(sequence.participants.map((participant) => [participant.label, participant.shape ?? "participant"])).toEqual([
      ["Customer", "actor"],
      ["Web Shop", "participant"],
      ["O", "participant"],
      ["Q", "participant"],
    ]);
    const [c, w, o, q] = sequence.participants.map((participant) => participant.id);
    const messages = sequence.steps.filter((step): step is SequenceMessage => step.type === "message");
    expect(messages.map((message) => [message.from, message.to, message.label, message.kind ?? "call"])).toEqual([
      [c, w, "Place order", "call"],
      [w, o, "Create order now", "call"],
      [o, o, "Check stock", "call"],
      [o, q, "OrderPlaced", "async"],
      [o, w, "Error", "reply"],
      [o, w, "42", "reply"],
    ]);
    expect(sequence.steps.filter((step) => step.type === "note")).toEqual([
      expect.objectContaining({ over: [w, o], text: "Retries twice" }),
      expect.objectContaining({ over: [c], text: "Waits" }),
    ]);
    expect(fixes).toEqual([
      "Flattened 2 loop/alt/opt/par blocks: their messages are kept in order, without the box around them.",
      "Skipped 1 line that couldn't be read.",
    ]);
  });

  it("finds the diagram inside a Markdown fence, and refuses flowcharts with a pointer to draw.io", () => {
    expect(parseMermaidSequence("# Doc\n```mermaid\nsequenceDiagram\nA->>B: hi\n```").sequence.steps).toHaveLength(1);
    expect(() => parseMermaidSequence("flowchart LR\nA-->B")).toThrow(/flowchart.*draw.io/);
    expect(() => parseMermaidSequence("pie\n")).toThrow(ImportError);
  });

  it("keeps #code; past Unicode as written, in an import and in the code view", () => {
    const label = ({ sequence }: { sequence: { steps: unknown[] } }) => (sequence.steps[0] as SequenceMessage).label;
    expect(label(parseMermaidSequence("sequenceDiagram\nA->>B: hi #99999999; #59; there"))).toBe("hi #99999999; ; there");
    expect(label(readSequenceCode("sequenceDiagram\nA->>B: #99999999999999999999;"))).toBe("#99999999999999999999;");
  });
});

describe("importing a file", () => {
  it("knows which files it reads", () => {
    expect(["a.drawio", "a.DRAWIO", "a.xml", "a.mmd", "notes.md"].every(isImportable)).toBe(true);
    expect(isImportable("a.json")).toBe(false);
  });

  it("makes a sequence tab from Mermaid and architecture tabs from draw.io, named after the file", async () => {
    const mermaid = await importDiagramText("sequenceDiagram\nA->>B: hi", "login.mmd");
    expect(mermaid).toMatchObject({ name: "login", fixes: [], sections: [{ name: "login", kind: "sequence" }] });

    const drawio = await importDiagramText(MODEL, "platform.drawio.xml");
    expect(drawio.name).toBe("platform");
    expect(drawio.sections[0].kind).toBeUndefined();
    const diagram = diagramFromImport(drawio);
    expect(diagram.legend.at(-1)?.label).toBe("Imported #dae8fc");
    expect(diagram.activeSectionId).toBe(diagram.sections[0].id);
  });

  it("refuses empty text", async () => {
    await expect(importDiagramText("  ")).rejects.toThrow(/nothing to import/);
  });
});
