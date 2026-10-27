import { createBlankDiagram, createBlankSection } from "@/lib/diagram/factory";
import { newMessage, newNote, newParticipant } from "@/lib/diagram/sequence";
import type { Diagram, SequenceMessageKind, SequenceStep } from "@/lib/diagram/types";

/** Who takes part, by name: [label, legend category, or "actor" for a person]. */
export type ParticipantSpec = [string, string];

/** [from, to, what, protocol, kind], or a note: ["note", over (names joined by ","), text]. */
export type StepSpec = [string, string, string, string?, SequenceMessageKind?] | ["note", string, string];

/** A diagram with one sequence tab, written as data like the architecture templates; fresh ids on every call. */
export function buildSequenceDiagram(name: string, tab: string, participantSpecs: ParticipantSpec[], stepSpecs: StepSpec[]): Diagram {
  const diagram = createBlankDiagram(name);
  const section = createBlankSection(tab, "sequence");
  const participants = participantSpecs.map(([label, category]) =>
    category === "actor" ? newParticipant(label, "actor") : newParticipant(label, "participant", category),
  );
  const id = (label: string) => participants.find((participant) => participant.label === label)!.id;
  const steps: SequenceStep[] = stepSpecs.map((step) =>
    step[0] === "note"
      ? newNote(step[1].split(",").map(id), step[2])
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
}
