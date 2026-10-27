import { describe, expect, it } from "vitest";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { parseDiagramFile } from "@/lib/diagram/file";
import { ImportError, importDiagramText, readImportText } from "@/lib/diagram/importFile";
import { MAX_FILE_BYTES, MAX_NAME_LENGTH, MAX_NODES, MAX_SECTIONS, MAX_TEXT_LENGTH } from "@/lib/diagram/limits";
import { DiagramFileError, parseDiagram } from "@/lib/diagram/validate";

/** A file object that claims a size without holding the bytes. */
function fakeFile(name: string, size: number, text = "{}"): File {
  return { name, size, text: async () => text } as unknown as File;
}

const node = (id: string) => ({ id, type: "block", position: { x: 0, y: 0 }, data: { label: id, colorKey: "product" } });

describe("size limits", () => {
  it("refuses an oversized diagram file without reading it", async () => {
    const file = fakeFile("big.json", MAX_FILE_BYTES + 1);
    await expect(parseDiagramFile(file)).rejects.toThrow(DiagramFileError);
  });

  it("refuses an oversized import without reading it", async () => {
    await expect(readImportText(fakeFile("big.drawio", MAX_FILE_BYTES + 1))).rejects.toThrow(ImportError);
    await expect(readImportText(fakeFile("ok.mmd", 10, "sequenceDiagram"))).resolves.toBe("sequenceDiagram");
  });

  it("refuses too many components in a tab, and too many tabs", () => {
    const diagram = JSON.parse(JSON.stringify(createBlankDiagram("x")));
    diagram.sections[0].nodes = Array.from({ length: MAX_NODES + 1 }, (_, i) => node(`n${i}`));
    expect(() => parseDiagram(diagram)).toThrow(/too large/);

    const many = JSON.parse(JSON.stringify(createBlankDiagram("x")));
    many.sections = Array.from({ length: MAX_SECTIONS + 1 }, () => many.sections[0]);
    expect(() => parseDiagram(many)).toThrow(/too large/);
  });

  it("refuses a draw.io page that inflates past the limit, and still reads a normal compressed page", async () => {
    const compress = async (text: string) => {
      const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      return Buffer.from(await new Response(stream).arrayBuffer()).toString("base64");
    };
    const wrap = (payload: string) => `<mxfile><diagram name="P">${payload}</diagram></mxfile>`;

    // ~60 MB of spaces compresses to a few tens of KB.
    const bomb = await compress(encodeURIComponent("<mxGraphModel><root>" + " ".repeat(60 * 1024 * 1024) + "</root></mxGraphModel>"));
    await expect(importDiagramText(wrap(bomb), "bomb.drawio")).rejects.toThrow(/expands to more than/);

    const model = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="A" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>`;
    const result = await importDiagramText(wrap(await compress(encodeURIComponent(model))), "ok.drawio");
    expect(result.sections[0].nodes).toHaveLength(1);
  });
});

describe("text limits", () => {
  it("refuses a very long Mermaid line quickly instead of stalling", async () => {
    const started = Date.now();
    await expect(importDiagramText(`sequenceDiagram\nA${" ".repeat(100_000)}->>B: hi`, "x.mmd")).rejects.toThrow(/longer than/);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("cuts very long names and text, and says so", () => {
    const diagram = JSON.parse(JSON.stringify(createBlankDiagram("x")));
    diagram.name = "n".repeat(5_000);
    diagram.sections[0].name = "s".repeat(5_000);
    diagram.sections[0].nodes = [{ ...node("a"), data: { label: "l".repeat(5_000), colorKey: "product", notes: "z".repeat(50_000) } }];
    const { diagram: parsed, fixes } = parseDiagram(diagram);
    expect(parsed.name).toHaveLength(MAX_NAME_LENGTH);
    expect(parsed.sections[0].name).toHaveLength(MAX_NAME_LENGTH);
    const data = parsed.sections[0].nodes[0].data as { label: string; notes?: string };
    expect(data.label).toHaveLength(MAX_NAME_LENGTH);
    expect(data.notes?.length).toBeLessThanOrEqual(MAX_TEXT_LENGTH);
    expect(fixes.some((fix) => /Shortened 4 /.test(fix))).toBe(true);
  });

  it("reports nothing for ordinary files", () => {
    expect(parseDiagram(JSON.parse(JSON.stringify(createBlankDiagram("x")))).fixes.some((fix) => /Shortened/.test(fix))).toBe(false);
  });
});
