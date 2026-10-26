import { describe, expect, it } from "vitest";
import { applySequenceCode, readSequenceCode, toMermaidSequence } from "@/lib/diagram/exportMermaid";
import { addParticipant, addStep, emptySequence, newMessage, newNote, newParticipant } from "@/lib/diagram/sequence";
import type { SequenceDiagram } from "@/lib/diagram/types";
import { sequenceTemplate } from "@/templates/sequence";

/** A sequence without ids, to compare what it says rather than how it's stored. */
function shape(sequence: SequenceDiagram) {
  const name = (id: string) => sequence.participants.find((participant) => participant.id === id)?.label;
  return {
    numbered: sequence.numbered !== false,
    participants: sequence.participants.map((participant) => [participant.label, participant.shape ?? "participant"]),
    steps: sequence.steps.map((step) =>
      step.type === "note"
        ? ["note", step.over.map(name), step.text]
        : ["message", name(step.from), name(step.to), step.label, step.protocol, step.kind ?? "call"],
    ),
  };
}

function sample() {
  const user = newParticipant("Customer", "actor");
  const shop = newParticipant("Web Shop");
  const pay = newParticipant("Pay; Gateway #2");
  let sequence = [user, shop, pay].reduce((current, participant) => addParticipant(current, participant), emptySequence());
  sequence = addStep(sequence, newMessage(user.id, shop.id, { label: "Place order", protocol: "HTTPS" }));
  sequence = addStep(sequence, newMessage(shop.id, pay.id, { label: "Charge card", kind: "async" }));
  sequence = addStep(sequence, newNote([shop.id, pay.id], "Retries twice\nthen gives up"));
  sequence = addStep(sequence, newMessage(pay.id, shop.id, { kind: "reply" }));
  sequence = addStep(sequence, newMessage(shop.id, shop.id, { label: "Log it" }));
  return { sequence, user, shop, pay };
}

describe("Mermaid code for a sequence", () => {
  it("writes readable Mermaid: aliases for names with spaces, arrows by kind, protocol in brackets, autonumber", () => {
    const code = toMermaidSequence(sample().sequence, "Checkout");
    expect(code).toBe(
      [
        "sequenceDiagram",
        "  title Checkout",
        "  autonumber",
        "  actor Customer",
        "  participant WebShop as Web Shop",
        "  participant PayGateway2 as Pay#59; Gateway #35;2",
        "  Customer->>WebShop: Place order (HTTPS)",
        "  WebShop-)PayGateway2: Charge card",
        "  Note over WebShop,PayGateway2: Retries twice<br>then gives up",
        "  PayGateway2-->>WebShop:",
        "  WebShop->>WebShop: Log it",
        "",
      ].join("\n"),
    );
  });

  it("reads back to the same sequence", () => {
    const { sequence } = sample();
    const parsed = readSequenceCode(toMermaidSequence(sequence, "Checkout"));
    expect(parsed.title).toBe("Checkout");
    expect(shape(applySequenceCode(emptySequence(), parsed))).toEqual(shape(sequence));
    // The template too, and without numbering.
    const template = sequenceTemplate.build().sections[0].sequence!;
    expect(shape(applySequenceCode(emptySequence(), readSequenceCode(toMermaidSequence(template))))).toEqual(shape(template));
    const unnumbered = { ...template, numbered: false };
    expect(applySequenceCode(template, readSequenceCode(toMermaidSequence(unnumbered))).numbered).toBe(false);
  });

  it("keeps what Mermaid can't say: a participant with the same name keeps its id, colour, description and link", () => {
    const { sequence, shop } = sample();
    const linked = {
      ...sequence,
      participants: sequence.participants.map((participant) =>
        participant.id === shop.id
          ? { ...participant, colorKey: "product" as const, description: "The storefront", component: { sectionId: "s1", id: "n1" } }
          : participant,
      ),
    };
    const code = toMermaidSequence(linked).replace("  WebShop->>WebShop: Log it\n", "  WebShop->>Warehouse: Reserve stock\n");
    const next = applySequenceCode(linked, readSequenceCode(code));
    const kept = next.participants.find((participant) => participant.label === "Web Shop")!;
    expect(kept).toEqual(linked.participants.find((participant) => participant.id === shop.id));
    // A new name is a new participant, and the messages point at the kept ids.
    expect(next.participants.map((participant) => participant.label)).toEqual(["Customer", "Web Shop", "Pay; Gateway #2", "Warehouse"]);
    const last = next.steps.at(-1)!;
    expect(last.type === "message" && last.from).toBe(shop.id);
  });

  it("only reads brackets as a protocol in the code view, not in imports from elsewhere", () => {
    const code = "sequenceDiagram\n  A->>B: Retry (twice)";
    const step = (sequence: SequenceDiagram) => sequence.steps[0];
    expect(step(readSequenceCode(code).sequence)).toMatchObject({ label: "Retry", protocol: "twice" });
    expect(step(readSequenceCode("sequenceDiagram\n  A->>B: (REST)").sequence)).toMatchObject({ protocol: "REST" });
    expect(step(readSequenceCode("sequenceDiagram\n  A->>B: (REST)").sequence)).not.toHaveProperty("label");
  });

  it("says what's wrong with code it can't read", () => {
    expect(() => readSequenceCode("flowchart LR\n  A --> B")).toThrow(/flowchart/);
    expect(() => readSequenceCode("sequenceDiagram\n")).toThrow(/no participants/);
  });
});
