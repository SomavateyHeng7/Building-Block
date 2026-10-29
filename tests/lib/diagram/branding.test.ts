import { beforeEach, describe, expect, it } from "vitest";
import { parseBranding, hasBranding } from "@/lib/diagram/branding";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { useDiagramStore } from "@/lib/diagram/store";
import { parseDiagram } from "@/lib/diagram/validate";
import { buildViewerHtml } from "@/lib/diagram/exportViewer";

const LOGO = "data:image/png;base64,iVBORw0KGgo=";

describe("branding in a file", () => {
  it("keeps a valid logo and colour, tidying the colour", () => {
    expect(parseBranding({ logo: LOGO, color: "ABC" })).toEqual({ logo: LOGO, color: "#aabbcc" });
    expect(parseBranding({ color: "#112233" })).toEqual({ color: "#112233" });
  });

  it("refuses pictures that aren't PNG, JPEG or WebP data, so an SVG or a web address can't get in", () => {
    for (const logo of ["data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "https://example.com/logo.png", "javascript:alert(1)", `${LOGO}"onerror="x`]) {
      expect(parseBranding({ logo })).toBeUndefined();
    }
    expect(parseBranding({ logo: "data:image/png;base64," + "A".repeat(500_000) })).toBeUndefined();
    expect(parseBranding("nope")).toBeUndefined();
  });

  it("round-trips through a diagram file, and says when it left branding out", () => {
    const diagram = { ...createBlankDiagram(), branding: { logo: LOGO, color: "#112233" } };
    expect(parseDiagram(JSON.parse(JSON.stringify(diagram))).diagram.branding).toEqual({ logo: LOGO, color: "#112233" });

    const bad = parseDiagram({ ...createBlankDiagram(), branding: { logo: "x", color: "red" } });
    expect(bad.diagram.branding).toBeUndefined();
    expect(bad.fixes.join(" ")).toMatch(/Left out the export logo and colour/);
  });
});

describe("setBranding", () => {
  beforeEach(() => useDiagramStore.getState().loadDiagram(createBlankDiagram()));

  it("sets and removes branding, with the logo and the colour as separate undo steps, and ignores an empty one", () => {
    const store = () => useDiagramStore.getState();
    store().setBranding({ logo: LOGO });
    store().setBranding({ logo: LOGO, color: "#112233" });
    expect(store().diagram.branding).toEqual({ logo: LOGO, color: "#112233" });
    expect(hasBranding(store().diagram.branding)).toBe(true);

    store().undo();
    expect(store().diagram.branding).toEqual({ logo: LOGO });

    store().setBranding({ logo: undefined });
    expect(store().diagram.branding).toBeUndefined();
    expect("branding" in store().diagram).toBe(false);

    const steps = store().past.length;
    store().setBranding(undefined);
    expect(store().past.length).toBe(steps);
  });
});

describe("branding in the viewer", () => {
  const page = [{ label: "A", svg: '<svg width="10" height="10"></svg>' }];

  it("adds the accent and logo", () => {
    const html = buildViewerHtml("P", page, false, { logo: LOGO, color: "#112233" });
    expect(html).toContain("border-top:4px solid #112233");
    expect(html).toContain(`<img class="logo" alt="" src="${LOGO}">`);
  });

  it("drops anything that isn't a plain colour or picture", () => {
    const html = buildViewerHtml("P", page, false, { logo: 'x" onerror="alert(1)', color: 'red;"><script>' });
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("border-top:4px");
  });
});
