import { describe, expect, it } from "vitest";
import {
  balanceSteps,
  frameOf,
  layoutSequence,
  moveStep,
  newBlock,
  newEnd,
  newMessage,
  newParticipant,
  removeStep,
  splitCaption,
  wrapSteps,
} from "@/lib/diagram/sequence";
import { applySequenceCode, readSequenceCode, toMermaidSequence } from "@/lib/diagram/exportMermaid";
import { tokenizeMermaidLine } from "@/lib/diagram/importMermaid";
import { parseDiagram } from "@/lib/diagram/validate";
import { createBlankDiagram, createBlankSection } from "@/lib/diagram/factory";
import type { SequenceDiagram } from "@/lib/diagram/types";

const a = newParticipant("A");
const b = newParticipant("B");
const base = (): SequenceDiagram => ({ participants: [a, b], steps: [newMessage(a.id, b.id, { label: "one" }), newMessage(b.id, a.id, { label: "two" })] });
const types = (sequence: SequenceDiagram) => sequence.steps.map((step) => (step.type === "block" ? step.kind : step.type));

describe("frames", () => {
  it("wraps steps, giving an alt its else part straight away", () => {
    const wrapped = wrapSteps(base(), newBlock("alt", "ok"), 0, 1);
    expect(types(wrapped)).toEqual(["alt", "message", "message", "else", "end"]);
    expect(types(wrapSteps(base(), newBlock("loop"), 1))).toEqual(["message", "loop", "end", "message"]);
  });

  it("finds a frame from any of its markers, and removes it whole while keeping what was inside", () => {
    const wrapped = wrapSteps(base(), newBlock("alt"), 0, 1);
    const elseId = wrapped.steps[3].id;
    expect(frameOf(wrapped.steps, elseId)).toEqual({ start: 0, dividers: [3], end: 4 });
    expect(types(removeStep(wrapped, elseId))).toEqual(["message", "message"]);
  });

  it("pairs up markers that don't match", () => {
    const steps = [newEnd(), newBlock("opt"), ...base().steps];
    expect(types({ participants: [], steps: balanceSteps(steps) })).toEqual(["opt", "message", "message", "end"]);
    const fine = base().steps;
    expect(balanceSteps(fine)).toBe(fine);
  });

  it("keeps a frame's start above its end when moved", () => {
    const wrapped = wrapSteps(base(), newBlock("loop"), 0, 0);
    const moved = moveStep(wrapped, wrapped.steps[0].id, 5);
    expect(types(moved)).toEqual(["message", "loop", "end", "message"]);
  });

  it("lays frames round what's inside them, nested ones inside outer ones", () => {
    const inner = wrapSteps(base(), newBlock("loop"), 0, 0);
    const outer = wrapSteps(inner, newBlock("opt"), 0, inner.steps.length - 1);
    const layout = layoutSequence(outer);
    const [opt, loop] = layout.frames;
    expect(opt.block.kind).toBe("opt");
    expect(opt.left).toBeLessThan(loop.left);
    expect(opt.right).toBeGreaterThan(loop.right);
    expect(opt.top).toBeLessThan(loop.top);
    expect(opt.bottom).toBeGreaterThan(loop.bottom);
    // Nothing is pushed off the left of the sheet.
    expect(opt.left).toBeGreaterThan(0);
  });
});

describe("activations", () => {
  it("draws a bar from + to -, and starts and ends arrows at its edge", () => {
    const call = newMessage(a.id, b.id, { activate: true });
    const reply = newMessage(b.id, a.id, { kind: "reply", deactivate: true });
    const layout = layoutSequence({ participants: [a, b], steps: [call, reply] });
    expect(layout.activations).toHaveLength(1);
    const [bar] = layout.activations;
    const [first, second] = layout.rows;
    expect(bar).toMatchObject({ participantId: b.id, top: first.y, bottom: second.y });
    const column = layout.columns[1].x;
    expect(first.toX).toBe(column - 5);
    expect(second.fromX).toBe(column - 5);
  });

  it("runs a bar that's never ended to the bottom", () => {
    const layout = layoutSequence({ participants: [a, b], steps: [newMessage(a.id, b.id, { activate: true })] });
    expect(layout.activations[0].bottom).toBe(layout.lifelineBottom - 8);
  });
});

describe("Mermaid with frames and activations", () => {
  const CODE = `sequenceDiagram
  participant A
  participant B
  A->>+B: Ask
  alt Yes
    B-->>-A: Sure
  else No
    B-->>A: Nope
  end
  loop Daily
    par
      A-)B: Ping
    and
      A-)B: Pong
    end
  end
`;

  it("reads them and writes them back as they were", () => {
    const parsed = readSequenceCode(CODE);
    expect(parsed.fixes).toEqual([]);
    expect(toMermaidSequence(applySequenceCode({ participants: [], steps: [], numbered: false }, parsed))).toBe(CODE);
  });

  it("closes a frame left open, and keeps what's inside colour boxes", () => {
    const { sequence, fixes } = readSequenceCode("sequenceDiagram\nrect rgb(0,0,0)\nA->>B: hi\nend\nloop forever\nA->>B: again");
    expect(types(sequence)).toEqual(["message", "loop", "message", "end"]);
    expect(fixes).toEqual([expect.stringMatching(/no "end"/), expect.stringMatching(/coloured box/)]);
  });

  it("turns activate/deactivate lines into the marks on the message before", () => {
    const { sequence } = readSequenceCode("sequenceDiagram\nA->>B: go\nactivate B\nB-->>A: done\ndeactivate B");
    expect(sequence.steps).toMatchObject([{ activate: true }, { deactivate: true }]);
  });

  it("survive a saved file", () => {
    const section = { ...createBlankSection("Flow", "sequence"), sequence: applySequenceCode({ participants: [], steps: [] }, readSequenceCode(CODE)) };
    const diagram = { ...createBlankDiagram(), sections: [section], activeSectionId: section.id };
    const reopened = parseDiagram(JSON.parse(JSON.stringify(diagram)));
    expect(reopened.fixes).toEqual([]);
    expect(reopened.diagram.sections[0].sequence).toEqual(section.sequence);
  });
});

describe("tokenizeMermaidLine", () => {
  it("gives the line back and marks what it is", () => {
    const line = "  A->>+B: Get orders (REST) %% why";
    const tokens = tokenizeMermaidLine(line);
    expect(tokens.map((token) => token.text).join("")).toBe(line);
    expect(tokens.filter((token) => token.kind !== "plain").map((token) => [token.kind, token.text.trim()])).toEqual([
      ["name", "A"],
      ["arrow", "->>+"],
      ["name", "B"],
      ["text", "Get orders"],
      ["protocol", "(REST)"],
      ["comment", "%% why"],
    ]);
    expect(tokenizeMermaidLine("this is wrong").map((token) => token.kind)).toEqual(["unknown"]);
    expect(tokenizeMermaidLine("  loop Every minute").map((token) => token.kind)).toEqual(["plain", "keyword", "text"]);
  });

  it("splits a caption into what's sent and its protocol", () => {
    expect(splitCaption("Place order (REST)")).toEqual({ label: "Place order", protocol: "REST" });
    expect(splitCaption("  ")).toEqual({});
  });
});
