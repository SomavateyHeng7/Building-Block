import { beforeEach, describe, expect, it } from "vitest";
import { createBlankDiagram, createBlankSection } from "@/lib/diagram/factory";
import { useDiagramStore } from "@/lib/diagram/store";
import { currentStepIndex, presentSteps, stepPresentation } from "@/components/editor/shared/present";
import type { Diagram, DiagramNode } from "@/lib/diagram/types";

const block = (id: string): DiagramNode => ({
  id,
  type: "block",
  position: { x: 0, y: 0 },
  size: { width: 100, height: 50 },
  data: { kind: "block", label: id, containerId: null },
});

/** Three tabs: "One" and "Three" have a component, "Two" is empty. */
function threeTabs(): Diagram {
  const diagram = createBlankDiagram("Deck");
  const [first] = diagram.sections;
  const second = createBlankSection("Two");
  const third = createBlankSection("Three");
  diagram.sections = [{ ...first, name: "One", nodes: [block("a")] }, second, { ...third, nodes: [block("b")] }];
  diagram.activeSectionId = first.id;
  return diagram;
}

describe("presenting", () => {
  beforeEach(() => {
    useDiagramStore.setState({ diagram: threeTabs(), selectedNodeIds: [], selectedEdgeId: null });
  });

  it("steps through the views that have something in them", () => {
    const steps = presentSteps(useDiagramStore.getState().diagram);
    expect(steps.map((step) => step.label)).toEqual(["One", "Three"]);
  });

  it("moves forward and back, stopping at the ends", () => {
    const active = () => useDiagramStore.getState().diagram.sections.find((s) => s.id === useDiagramStore.getState().diagram.activeSectionId)!.name;
    expect(active()).toBe("One");
    stepPresentation(-1);
    expect(active()).toBe("One");
    stepPresentation(1);
    expect(active()).toBe("Three");
    stepPresentation(1);
    expect(active()).toBe("Three");
    stepPresentation(-Infinity);
    expect(active()).toBe("One");
    stepPresentation(Infinity);
    expect(active()).toBe("Three");
  });

  it("starts from the first view when an empty tab is open, and says it isn't a step", () => {
    const { diagram } = useDiagramStore.getState();
    useDiagramStore.getState().setActiveSection(diagram.sections[1].id);
    expect(currentStepIndex(useDiagramStore.getState().diagram)).toBe(-1);
    stepPresentation(1);
    expect(useDiagramStore.getState().diagram.activeSectionId).toBe(diagram.sections[0].id);
  });

  it("is navigation, not an edit", () => {
    const before = useDiagramStore.getState().past.length;
    stepPresentation(1);
    expect(useDiagramStore.getState().past.length).toBe(before);
  });
});
