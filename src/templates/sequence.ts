import { createBlankDiagram, createBlankSection } from "@/lib/diagram/factory";
import { newMessage, newNote, newParticipant } from "@/lib/diagram/sequence";
import type { SequenceMessageKind, SequenceStep } from "@/lib/diagram/types";
import type { TemplateDefinition } from "./types";

/** Who takes part, by name: [label, legend category, or "actor" for a person]. */
const PARTICIPANTS: [string, string][] = [
  ["Customer", "actor"],
  ["Web Shop", "product"],
  ["Orders Service", "microservice"],
  ["Payment Gateway", "third-party"],
  ["Notification Service", "microservice"],
];

/** [from, to, what, protocol, kind], or a note: ["note", over, text]. */
const STEPS: ([string, string, string, string?, SequenceMessageKind?] | ["note", string, string])[] = [
  ["Customer", "Web Shop", "Place order"],
  ["Web Shop", "Orders Service", "Create order", "REST"],
  ["Orders Service", "Orders Service", "Check stock"],
  ["Orders Service", "Payment Gateway", "Authorise payment", "REST"],
  ["Payment Gateway", "Orders Service", "Payment authorised", undefined, "reply"],
  ["note", "Orders Service", "Retries twice if the gateway times out, then cancels the order"],
  ["Orders Service", "Notification Service", "OrderConfirmed", "Kafka", "async"],
  ["Orders Service", "Web Shop", "Order number", undefined, "reply"],
  ["Web Shop", "Customer", "Confirmation page", undefined, "reply"],
  ["Notification Service", "Customer", "Confirmation email", "SMTP", "async"],
];

export const sequenceTemplate: TemplateDefinition = {
  id: "sequence",
  name: "Sequence diagram",
  description: "A checkout flow step by step: who calls whom, in what order, sync or async. Pair it with an L0 tab to explain how the architecture is used.",
  build: () => {
    const diagram = createBlankDiagram("Checkout flow");
    const section = createBlankSection("Checkout", "sequence");
    const participants = PARTICIPANTS.map(([label, category]) =>
      category === "actor" ? newParticipant(label, "actor") : newParticipant(label, "participant", category),
    );
    const id = (label: string) => participants.find((participant) => participant.label === label)!.id;
    const steps: SequenceStep[] = STEPS.map((step) =>
      step[0] === "note"
        ? newNote([id(step[1])], step[2])
        : newMessage(id(step[0]), id(step[1]), {
            label: step[2],
            ...(step[3] ? { protocol: step[3] } : {}),
            ...(step[4] ? { kind: step[4] } : {}),
          }),
    );
    return {
      ...diagram,
      sections: [{ ...section, sequence: { participants, steps } }],
      activeSectionId: section.id,
    };
  },
};
