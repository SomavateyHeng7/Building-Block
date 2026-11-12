// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import SequenceCanvas from "@/components/editor/sequence/SequenceCanvas";
import { createBlankDiagram, createBlankSection } from "@/lib/diagram/factory";
import { SEQUENCE_LAYOUT, layoutSequence } from "@/lib/diagram/sequence/sequence";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import type { SequenceDiagram } from "@/lib/diagram/types";

/** jsdom lays nothing out, so the sheet sits at 0,0 and client pixels are sheet pixels. */
const SEQUENCE: SequenceDiagram = {
  participants: [
    { id: "a", label: "Alice", shape: "participant" },
    { id: "b", label: "Bob", shape: "participant" },
    { id: "c", label: "Carol", shape: "participant" },
  ],
  steps: [
    { id: "m1", type: "message", from: "a", to: "b", label: "first" },
    { id: "m2", type: "message", from: "b", to: "c", label: "second" },
    { id: "m3", type: "message", from: "c", to: "a", label: "third" },
  ],
};

const store = () => useDiagramStore.getState();
const sequence = () => getActiveSection(store().diagram).sequence!;

beforeEach(() => {
  const diagram = createBlankDiagram("Flow");
  const section = { ...createBlankSection("Login", "sequence"), sequence: SEQUENCE };
  store().loadDiagram({ ...diagram, sections: [section], activeSectionId: section.id });
});
afterEach(cleanup);

function drag(element: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(element, { button: 0, clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(window, { clientX: (from.x + to.x) / 2, clientY: (from.y + to.y) / 2 });
  fireEvent.pointerMove(window, { clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(window, { clientX: to.x, clientY: to.y });
}

describe("SequenceCanvas dragging", () => {
  const layout = layoutSequence(SEQUENCE);
  const column = (id: string) => layout.columns.find((candidate) => candidate.participant.id === id)!;
  const row = (id: string) => layout.rows.find((candidate) => candidate.step.id === id)!;

  it("moves a participant sideways to where it's let go", () => {
    const { container } = render(<SequenceCanvas />);
    const head = container.querySelector('[data-participant="a"]')!;
    const y = SEQUENCE_LAYOUT.margin + 10;
    drag(head, { x: column("a").x, y }, { x: column("c").x + 40, y });
    expect(sequence().participants.map((participant) => participant.id)).toEqual(["b", "c", "a"]);
  });

  it("moves a message up or down to where it's let go", () => {
    const { container } = render(<SequenceCanvas />);
    const arrow = container.querySelector('[data-step="m3"]')!;
    drag(arrow, { x: column("b").x, y: row("m3").y }, { x: column("b").x, y: row("m1").top + 2 });
    expect(sequence().steps.map((step) => step.id)).toEqual(["m3", "m1", "m2"]);
  });

  it("leaves things where they are on a click", () => {
    const { container } = render(<SequenceCanvas />);
    const head = container.querySelector('[data-participant="a"]')!;
    drag(head, { x: column("a").x, y: 30 }, { x: column("a").x + 3, y: 30 });
    expect(sequence()).toBe(SEQUENCE);
  });

  it("scrolls when the empty sheet is dragged", () => {
    const { container } = render(<SequenceCanvas />);
    const svg = container.querySelector("svg[role=group]")!;
    const scroller = svg.closest(".overflow-auto") as HTMLDivElement;
    scroller.scrollLeft = 200;
    scroller.scrollTop = 100;
    drag(svg, { x: 300, y: 300 }, { x: 250, y: 260 });
    expect([scroller.scrollLeft, scroller.scrollTop]).toEqual([250, 140]);
    expect(sequence()).toBe(SEQUENCE);
  });
});
