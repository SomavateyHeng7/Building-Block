import { beforeEach, describe, expect, it } from "vitest";
import {
  SEQUENCE_LAYOUT,
  addParticipant,
  addStep,
  columnAt,
  emptySequence,
  layoutSequence,
  messageNumbers,
  moveParticipant,
  moveStep,
  newMessage,
  newNote,
  newParticipant,
  removeParticipant,
  stepIndexAt,
  updateStep,
} from "@/lib/diagram/sequence";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { parseDiagram } from "@/lib/diagram/validate";
import { legendUsedIn } from "@/lib/diagram/export";
import { exportViews } from "@/lib/diagram/exportPlan";
import type { SequenceDiagram } from "@/lib/diagram/types";

const store = () => useDiagramStore.getState();
const active = () => getActiveSection(store().diagram);

/** Three participants, a call, a reply and a note. */
function sample() {
  const a = newParticipant("Alpha");
  const b = newParticipant("Beta", "actor");
  const c = newParticipant("Gamma", "participant", "microservice");
  let sequence: SequenceDiagram = emptySequence();
  for (const participant of [a, b, c]) sequence = addParticipant(sequence, participant);
  const call = newMessage(a.id, b.id, { label: "Ask" });
  const note = newNote([b.id, c.id], "Thinks");
  const reply = newMessage(b.id, a.id, { label: "Answer", kind: "reply" });
  sequence = addStep(addStep(addStep(sequence, call), note), reply);
  return { sequence, a, b, c, call, note, reply };
}

describe("editing a sequence", () => {
  it("removes a participant with its messages, keeping notes that still have someone under them", () => {
    const { sequence, a, b, c, note } = sample();
    const without = removeParticipant(sequence, b.id);
    expect(without.participants.map((participant) => participant.id)).toEqual([a.id, c.id]);
    expect(without.steps).toEqual([{ ...note, over: [c.id] }]);
    expect(removeParticipant(without, c.id).steps).toEqual([]);
  });

  it("moves participants and steps, clamping at the ends", () => {
    const { sequence, a, b, c, call, note, reply } = sample();
    expect(moveParticipant(sequence, a.id, 99).participants.map((p) => p.id)).toEqual([b.id, c.id, a.id]);
    expect(moveStep(sequence, reply.id, 0).steps.map((s) => s.id)).toEqual([reply.id, call.id, note.id]);
    expect(moveStep(sequence, call.id, 0)).toBe(sequence);
  });

  it("drops blank text but keeps a note's text as typed", () => {
    const { sequence, call, note } = sample();
    const edited = updateStep(updateStep(sequence, call.id, { label: "  ", protocol: "REST" }), note.id, { text: "" });
    expect(edited.steps[0]).toMatchObject({ label: undefined, protocol: "REST" });
    expect(edited.steps[1]).toMatchObject({ text: "" });
  });

  it("numbers messages only, in order", () => {
    const { sequence, call, reply } = sample();
    expect([...messageNumbers(sequence)]).toEqual([
      [call.id, 1],
      [reply.id, 2],
    ]);
  });
});

describe("laying out a sequence", () => {
  it("puts participants left to right and steps top to bottom, widening gaps for long captions", () => {
    const { sequence, a } = sample();
    const layout = layoutSequence(sequence);
    const xs = layout.columns.map((column) => column.x);
    expect(xs).toEqual([...xs].sort((p, q) => p - q));
    const tops = layout.rows.map((row) => row.top);
    expect(tops).toEqual([...tops].sort((p, q) => p - q));
    expect(layout.rows[0].top).toBe(layout.lifelineTop + SEQUENCE_LAYOUT.firstGap);

    const long = updateStep(sequence, sequence.steps[0].id, { label: "A very long message label that needs a lot of room" });
    const wider = layoutSequence(long);
    expect(wider.columns[1].x - wider.columns[0].x).toBeGreaterThan(xs[1] - xs[0]);
    expect(columnAt(layout, xs[0] + 5)?.participant.id).toBe(a.id);
  });

  it("places a new message between the rows around where it was dropped", () => {
    const layout = layoutSequence(sample().sequence);
    expect(stepIndexAt(layout, 0)).toBe(0);
    expect(stepIndexAt(layout, layout.rows[0].top + layout.rows[0].height + 1)).toBe(1);
    expect(stepIndexAt(layout, layout.lifelineBottom)).toBe(3);
  });
});

describe("sequence tabs", () => {
  beforeEach(() => store().loadDiagram(createBlankDiagram()));

  it("are added, edited as one undo step each, and can't take boxes", () => {
    store().addSection(undefined, "sequence");
    expect(active()).toMatchObject({ kind: "sequence", name: "Sequence 2", nodes: [], sequence: { participants: [], steps: [] } });
    const participant = newParticipant("Alpha");
    store().updateSequence((sequence) => addParticipant(sequence, participant));
    expect(active().sequence?.participants).toEqual([participant]);

    store().addBlock({ x: 0, y: 0 });
    store().addContainer({ x: 0, y: 0 });
    expect(active().nodes).toEqual([]);

    store().undo();
    expect(active().sequence?.participants).toEqual([]);
  });

  it("are duplicated with their sequence, and recoloured when a category is removed", () => {
    const { sequence, c } = sample();
    store().addSection("Flow", "sequence");
    store().updateSequence(() => sequence);
    store().duplicateSection(active().id);
    expect(active()).toMatchObject({ name: "Flow copy", kind: "sequence", sequence });

    store().removeLegendEntry("microservice", "product");
    for (const section of store().diagram.sections.slice(1)) {
      expect(section.sequence?.participants.find((p) => p.id === c.id)?.colorKey).toBe("product");
    }
  });

  it("survive saving and opening, and broken steps are dropped with a note", () => {
    const { sequence, a } = sample();
    store().addSection("Flow", "sequence");
    store().updateSequence(() => ({ ...sequence, numbered: false }));
    const saved = JSON.parse(JSON.stringify(store().diagram));
    expect(parseDiagram(saved)).toMatchObject({ fixes: [], diagram: { sections: [{}, { kind: "sequence", sequence: { ...sequence, numbered: false } }] } });

    saved.sections[1].sequence.steps.push({ id: "x", type: "message", from: a.id, to: "gone" }, { id: "y", type: "note", over: [] });
    const { diagram, fixes } = parseDiagram(saved);
    expect(diagram.sections[1].sequence?.steps).toHaveLength(3);
    expect(fixes).toEqual(['"Flow": skipped 2 steps that couldn\'t be read or named a missing participant.']);
  });

  it("are pictured once they have a participant, with the legend of their participants' colours", () => {
    const { sequence } = sample();
    store().addSection("Flow", "sequence");
    const empty = exportViews(store().diagram).find((view) => view.label === "Flow");
    expect(empty?.nodeCount).toBe(0);
    store().updateSequence(() => sequence);
    expect(exportViews(store().diagram).find((view) => view.label === "Flow")?.nodeCount).toBe(3);
    expect(legendUsedIn(store().diagram, active()).map((entry) => entry.key)).toEqual(["microservice"]);
  });
});
