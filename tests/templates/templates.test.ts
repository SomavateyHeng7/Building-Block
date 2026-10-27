import { describe, expect, it } from "vitest";
import { allTemplates as templates, templates as listed } from "@/templates";
import { parseDiagram } from "@/lib/diagram/validate";
import { growContainerToFit } from "@/lib/diagram/layout";

describe("templates", () => {
  it("have unique ids", () => {
    expect(new Set(templates.map((template) => template.id)).size).toBe(templates.length);
  });

  for (const template of templates) {
    describe(template.name, () => {
      it("opens without repairs", () => {
        const { fixes } = parseDiagram(JSON.parse(JSON.stringify(template.build())));
        expect(fixes).toEqual([]);
      });

      it("mints fresh ids on every build", () => {
        const ids = (diagram: ReturnType<typeof template.build>) =>
          diagram.sections.flatMap((section) => [
            ...section.nodes.map((node) => node.id),
            ...(section.sequence?.participants ?? []).map((participant) => participant.id),
            ...(section.sequence?.steps ?? []).map((step) => step.id),
          ]);
        const first = ids(template.build());
        expect(first.filter((id) => ids(template.build()).includes(id))).toEqual([]);
      });

      it("connects every connection it lists and fits every component in its container", () => {
        const diagram = template.build();
        for (const section of diagram.sections) {
          const canvases = [
            section,
            ...section.nodes.flatMap((node) => (node.data.kind === "block" && node.data.detail ? [node.data.detail] : [])),
          ];
          for (const canvas of canvases) {
            const ids = new Set(canvas.nodes.map((node) => node.id));
            for (const edge of canvas.edges ?? []) {
              expect(ids.has(edge.source) && ids.has(edge.target)).toBe(true);
            }
            for (const container of canvas.nodes.filter((node) => node.type === "container")) {
              // Already big enough: growing to fit changes nothing.
              expect(growContainerToFit(canvas.nodes, container.id)).toEqual(canvas.nodes);
            }
          }
        }
      });
    });
  }

  it("offer every template but the hidden ones, with sequence templates among them", () => {
    expect(listed.map((template) => template.id)).not.toContain("current-vs-target");
    expect(listed.length).toBe(templates.filter((template) => !template.hidden).length);
    const sequences = listed.filter((template) => template.build().sections.some((section) => section.kind === "sequence"));
    expect(sequences.map((template) => template.id)).toEqual(["sequence", "oidc-sign-in", "cache-aside"]);
  });

  it("the richer templates show connections, an internal design and several tabs", () => {
    const built = Object.fromEntries(templates.map((template) => [template.id, template.build()]));
    expect(built["three-tier"].sections[0].edges?.length).toBeGreaterThan(0);
    expect(
      built["event-driven"].sections[0].nodes.some((node) => node.data.kind === "block" && node.data.detail?.nodes.length),
    ).toBe(true);
    expect(built["current-vs-target"].sections.map((section) => section.name)).toEqual(["Current", "Target"]);
  });
});
