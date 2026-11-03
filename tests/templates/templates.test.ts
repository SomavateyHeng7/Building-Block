import { describe, expect, it } from "vitest";
import { templates } from "@/templates";
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

  describe("horizontal lanes", () => {
    const orientable = templates.filter((template) => template.orientable);

    it("are offered by at least the cross-functional template", () => {
      expect(orientable.map((template) => template.id)).toContain("cross-functional");
    });

    for (const template of orientable) {
      it(`${template.name} opens without repairs and fits every step in its lane`, () => {
        const diagram = template.build({ orientation: "horizontal" });
        expect(parseDiagram(JSON.parse(JSON.stringify(diagram))).fixes).toEqual([]);
        for (const section of diagram.sections) {
          for (const container of section.nodes.filter((node) => node.type === "container")) {
            expect(growContainerToFit(section.nodes, container.id)).toEqual(section.nodes);
          }
        }
      });

      it(`${template.name} stacks the lanes top to bottom, with steps in flow order along each lane`, () => {
        const vertical = template.build({ orientation: "vertical" }).sections[0];
        const horizontal = template.build({ orientation: "horizontal" }).sections[0];
        const lanes = (section: typeof vertical) => section.nodes.filter((node) => node.type === "container");
        // Same lanes, same steps and connections; only the arrangement differs.
        expect(lanes(horizontal).map((node) => node.data.label)).toEqual(lanes(vertical).map((node) => node.data.label));
        expect(horizontal.nodes.length).toBe(vertical.nodes.length);
        expect(horizontal.edges?.length).toBe(vertical.edges?.length);
        const ys = lanes(horizontal).map((node) => node.position.y);
        expect(ys).toEqual([...ys].sort((a, b) => a - b));
        expect(new Set(lanes(horizontal).map((node) => node.position.x))).toEqual(new Set([0]));
        // A step is never left of the step that hands work to it (loop-backs excepted).
        const byId = new Map(horizontal.nodes.map((node) => [node.id, node]));
        for (const edge of (horizontal.edges ?? []).filter((candidate) => candidate.style !== "dashed")) {
          const source = byId.get(edge.source)!;
          const target = byId.get(edge.target)!;
          expect(target.position.x).toBeGreaterThan(source.position.x);
        }
      });
    }

    it("never put two steps of one lane on the same spot", () => {
      for (const template of orientable) {
        for (const lane of template.build({ orientation: "horizontal" }).sections[0].nodes.filter((node) => node.type === "container")) {
          const xs = template
            .build({ orientation: "horizontal" })
            .sections[0].nodes.filter((node) => node.type === "block" && node.parentId === lane.id)
            .map((node) => node.position.x);
          expect(new Set(xs).size).toBe(xs.length);
        }
      }
    });
  });

  it("the new templates have connections, and the roadmap has three tabs in order", () => {
    for (const id of ["c4-context", "data-pipeline", "cloud-landing-zone", "migration-roadmap"]) {
      expect(templates.find((template) => template.id === id)?.build().sections[0].edges?.length).toBeGreaterThan(0);
    }
    expect(
      templates.find((template) => template.id === "migration-roadmap")?.build().sections.map((section) => section.name),
    ).toEqual(["Current", "Transition", "Target"]);
  });

  it("the richer templates show connections, an internal design and several tabs", () => {
    const built = Object.fromEntries(templates.map((template) => [template.id, template.build()]));
    expect(built["three-tier"].sections[0].edges?.length).toBeGreaterThan(0);
    expect(
      built["event-driven"].sections[0].nodes.some((node) => node.data.kind === "block" && node.data.detail?.nodes.length),
    ).toBe(true);
    // The loop-back leaves over the top, so it doesn't lie on top of the forward line between the same two lanes.
    const flow = built["cross-functional"].sections[0];
    expect(flow.nodes.filter((node) => node.type === "container").map((node) => node.data.label)).toEqual([
      "Requester", "Manager", "Finance", "Procurement", "Supplier",
    ]);
    const loop = flow.edges?.find((edge) => edge.label === "Rejected, revise");
    const forward = flow.edges?.find((edge) => edge.label === "Request");
    expect(flow.nodes.filter((node) => node.type === "block").length).toBe(13);
    expect(loop && forward && [loop.sourceSide, loop.targetSide]).toEqual(["top", "top"]);
    expect(forward?.sourceSide).toBe("right");
    expect(built["current-vs-target"].sections.map((section) => section.name)).toEqual(["Current", "Target"]);
  });
});
