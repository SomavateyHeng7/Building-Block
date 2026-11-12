import { describe, expect, it } from "vitest";
import { allTemplates as templates, templates as listed } from "@/templates";
import { parseDiagram } from "@/lib/diagram/validate";
import { growContainerToFit } from "@/lib/diagram/layout/layout";
import { buildCanvas } from "@/templates/build";
import { diagramHints } from "@/lib/diagram/features/hints";

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

  it("offer every template but the hidden ones, with sequence templates among them", () => {
    expect(listed.map((template) => template.id)).not.toContain("current-vs-target");
    expect(listed.length).toBe(templates.filter((template) => !template.hidden).length);
    const sequences = listed.filter((template) => template.build().sections.some((section) => section.kind === "sequence"));
    expect(sequences.map((template) => template.id)).toEqual(["sequence", "sequence-login"]);
  });

  it("the richer templates show connections, an internal design and several tabs", () => {
    const built = Object.fromEntries(templates.map((template) => [template.id, template.build()]));
    expect(built["three-tier"].sections[0].edges?.length).toBeGreaterThan(0);
    expect(
      built["event-driven"].sections[0].nodes.some((node) => node.data.kind === "block" && node.data.detail?.nodes.length),
    ).toBe(true);
    // The loop-back leaves from under its step and is bent off the forward line between the same two lanes.
    const flow = built["cross-functional"].sections[0];
    expect(flow.nodes.filter((node) => node.type === "container").map((node) => node.data.label)).toEqual([
      "Requester", "Manager", "Finance", "Procurement", "Supplier",
    ]);
    const loop = flow.edges?.find((edge) => edge.label === "Rejected, revise");
    const forward = flow.edges?.find((edge) => edge.label === "Request");
    expect(flow.nodes.filter((node) => node.type === "block").length).toBe(13);
    expect(loop && forward && [loop.sourceSide, loop.targetSide]).toEqual(["bottom", "top"]);
    expect([forward?.sourceSide, forward?.targetSide]).toEqual(["right", "left"]);
    expect(loop?.bend?.x).not.toBe(0);
    expect(forward?.bend).toBeUndefined();
    expect(built["current-vs-target"].sections.map((section) => section.name)).toEqual(["Current", "Target"]);
  });
});

describe("cross-functional loop-backs", () => {
  const template = templates.find((candidate) => candidate.id === "cross-functional")!;

  for (const orientation of ["vertical", "horizontal"] as const) {
    it(`${orientation}: never share an end with a forward line`, () => {
      const edges = template.build({ orientation }).sections[0].edges ?? [];
      const ends = (edge: (typeof edges)[number]) => [`${edge.source}:${edge.sourceSide}`, `${edge.target}:${edge.targetSide}`];
      const forwardEnds = new Set(edges.filter((edge) => edge.style !== "dashed").flatMap(ends));
      const loops = edges.filter((edge) => edge.style === "dashed");
      expect(loops.length).toBe(2);
      for (const loop of loops) expect(ends(loop).filter((end) => forwardEnds.has(end))).toEqual([]);
    });
  }

  it("route each layout its own way", () => {
    const sidesOf = (orientation: "vertical" | "horizontal") =>
      Object.fromEntries(
        (template.build({ orientation }).sections[0].edges ?? [])
          .filter((edge) => edge.style === "dashed")
          .map((edge) => [edge.label, [edge.sourceSide, edge.targetSide]]),
      );
    expect(sidesOf("vertical")).toEqual({ "Rejected, revise": ["bottom", "top"], "Over budget": ["top", "top"] });
    expect(sidesOf("horizontal")).toEqual({ "Rejected, revise": ["top", "top"], "Over budget": ["bottom", "bottom"] });
  });
});

describe("template connections", () => {
  for (const template of templates) {
    it(`${template.name}: every component takes part in at least one connection`, () => {
      for (const section of template.build().sections) {
        const canvases = [
          section,
          ...section.nodes.flatMap((node) => (node.data.kind === "block" && node.data.detail ? [node.data.detail] : [])),
        ];
        for (const canvas of canvases) {
          const touched = new Set((canvas.edges ?? []).flatMap((edge) => [edge.source, edge.target]));
          const lonely = canvas.nodes.filter((node) => node.type === "block" && !touched.has(node.id));
          // Only the blank, sequence and hidden ones may leave components unconnected.
          if (["blank", "sequence", "current-vs-target"].includes(template.id)) continue;
          expect(lonely.map((node) => node.data.label)).toEqual([]);
        }
      }
    });
  }
});

describe("internal designs and the newer templates", () => {
  const detailsOf = (id: string) =>
    templates
      .find((template) => template.id === id)!
      .build()
      .sections[0].nodes.flatMap((node) => (node.data.kind === "block" && node.data.detail ? [node.data.label] : []));

  it("offers an internal design (L2) to open on the larger architecture templates", () => {
    expect(detailsOf("event-driven")).toEqual(["Order Service"]);
    expect(detailsOf("three-tier")).toEqual(["Application Server"]);
    expect(detailsOf("serverless")).toEqual(["Bookings Function"]);
    expect(detailsOf("cloud-landing-zone")).toEqual(["App Servers"]);
    expect(detailsOf("data-platform")).toEqual(["Data Warehouse"]);
    expect(detailsOf("c4-context")).toEqual(["Order Platform"]);
  });

  it("gives only the roadmap's Target tab an internal design, so Compare tabs shows it as a change", () => {
    const [current, transition, target] = templates.find((template) => template.id === "migration-roadmap")!.build().sections;
    const designs = (section: typeof current) => section.nodes.filter((node) => node.data.kind === "block" && node.data.detail).map((node) => node.data.label);
    expect([designs(current), designs(transition), designs(target)]).toEqual([[], [], ["Order Service"]]);
  });

  it("has the incident escalation as a second process that can run in rows or columns", () => {
    const incident = templates.find((template) => template.id === "incident-escalation");
    expect(incident?.orientable).toBe(true);
    expect(incident?.category).toBe("Process");
    const lanes = incident!.build().sections[0].nodes.filter((node) => node.type === "container");
    expect(lanes.map((node) => node.data.label)).toEqual(["Customer", "Support", "Incident Manager", "Engineering"]);
  });

  it("has a data model whose relationships say how many", () => {
    const edges = templates.find((template) => template.id === "er-data-model")!.build().sections[0].edges ?? [];
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((edge) => /\((1|many) to (1|many)\)/.test(edge.label ?? ""))).toBe(true);
  });

  it("starts the sign-in sequence with the user and has a failure path", () => {
    const sequence = templates.find((template) => template.id === "sequence-login")!.build().sections[0].sequence!;
    expect(sequence.participants.map((participant) => participant.label)).toEqual(["User", "Web App", "Identity Provider", "Orders API"]);
    expect(sequence.steps.some((step) => "label" in step && step.label === "Sign-in failed")).toBe(true);
  });
});

describe("what Check would say about a new template", () => {
  it("never finds a component with no connections (the hidden current-vs-target excepted)", () => {
    for (const template of templates.filter((candidate) => candidate.id !== "current-vs-target")) {
      expect(diagramHints(template.build()).filter((hint) => hint.kind === "unconnected")).toEqual([]);
    }
  });

  it("finds no connection without a protocol in the architecture templates, where one is meaningful", () => {
    const architecture = [
      "l0-architecture", "three-tier", "event-driven", "serverless", "data-platform", "c4-context",
      "data-pipeline", "cloud-landing-zone", "ci-cd-pipeline", "security-zones", "migration-roadmap",
    ];
    for (const id of architecture) {
      const missing = diagramHints(templates.find((template) => template.id === id)!.build()).filter((hint) => hint.kind === "no-protocol");
      expect(missing.map((hint) => hint.label), id).toEqual([]);
    }
  });
});

describe("template builder", () => {
  it("refuses a connection that names a component that isn't there", () => {
    const spec = {
      columns: [[{ label: "A", components: [{ label: "One", colorKey: "product" as const }] }]],
      connections: [{ from: "One", to: "Missing", label: "Oops" }],
    };
    expect(() => buildCanvas(spec)).toThrow(/unknown component.*Missing/);
  });
});
