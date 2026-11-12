import { create } from "zustand";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import type { SequenceDiagram, SequenceParticipant, SequenceStep } from "@/lib/diagram/types";

/**
 * What's selected on a sequence tab: a participant or a step, by id. Screen state, like the canvas selection;
 * an id that has gone (deleted, undone, another tab) simply selects nothing.
 */
export const useSequenceSelection = create<{ id: string | null }>()(() => ({ id: null }));

/** The main text field of whatever is selected (a name, a message's label, a note's text), for focusing. */
export const SEQUENCE_LABEL_FIELD_ID = "bb-seq-label";

export function selectSequenceItem(id: string | null) {
  useSequenceSelection.setState({ id });
}

export type SequenceItem =
  | { kind: "participant"; participant: SequenceParticipant; index: number }
  | { kind: "step"; step: SequenceStep; index: number };

export function findSequenceItem(sequence: SequenceDiagram | undefined, id: string | null): SequenceItem | null {
  if (!sequence || !id) return null;
  const participant = sequence.participants.findIndex((candidate) => candidate.id === id);
  if (participant !== -1) return { kind: "participant", participant: sequence.participants[participant], index: participant };
  const step = sequence.steps.findIndex((candidate) => candidate.id === id);
  if (step !== -1) return { kind: "step", step: sequence.steps[step], index: step };
  return null;
}

/** The open tab's sequence, when it is a sequence tab. */
export function activeSequence(): SequenceDiagram | undefined {
  return getActiveSection(useDiagramStore.getState().diagram).sequence;
}
