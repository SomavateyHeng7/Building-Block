"use client";

import { useState, type ReactNode } from "react";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import {
  addStep,
  linkableComponents,
  moveParticipant,
  moveStep,
  newMessage,
  removeParticipant,
  removeStep,
  updateParticipant,
  updateStep,
} from "@/lib/diagram/sequence";
import type { SequenceDiagram, SequenceMessage, SequenceMessageKind, SequenceNote, SequenceParticipant } from "@/lib/diagram/types";
import { goTo } from "./canvasFocus";
import { Icon } from "./Icon";
import { SEQUENCE_LABEL_FIELD_ID, findSequenceItem, selectSequenceItem, useSequenceSelection } from "./sequenceSelection";

const SECTION_TITLE = "text-xs font-semibold uppercase tracking-wide text-zinc-500";
const PANEL = "flex flex-col gap-4 border-b border-zinc-200 p-4 dark:border-zinc-800";
const FIELD_LABEL = "flex flex-col gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300";
const FIELD =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-normal outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900";
const ACTION_BUTTON =
  "rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900";
const DELETE_BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950";
const HINT = "text-[11px] font-normal text-zinc-400";

const KIND_OPTIONS: { value: SequenceMessageKind; label: string; hint: string }[] = [
  { value: "call", label: "Call", hint: "Waits for an answer (solid line, filled arrow)" },
  { value: "async", label: "Async", hint: "Fire and forget, e.g. an event (open arrow)" },
  { value: "reply", label: "Reply", hint: "The answer to a call (dashed line)" },
];

function Title({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className={SECTION_TITLE}>{children}</h2>
      {action}
    </div>
  );
}

/** Edits whatever is selected on a sequence tab; with nothing selected, the tab as a whole. */
export default function SequencePanel({ headerAction }: { headerAction?: ReactNode }) {
  const sequence = useDiagramStore((state) => getActiveSection(state.diagram).sequence);
  const selectedId = useSequenceSelection((state) => state.id);
  const item = findSequenceItem(sequence, selectedId);
  if (!sequence) return null;

  if (item?.kind === "participant") {
    return <ParticipantPanel sequence={sequence} participant={item.participant} index={item.index} action={headerAction} />;
  }
  if (item?.step.type === "message") {
    return <MessagePanel sequence={sequence} message={item.step} index={item.index} action={headerAction} />;
  }
  if (item?.step.type === "note") {
    return <NotePanel sequence={sequence} note={item.step} index={item.index} action={headerAction} />;
  }
  return <OverviewPanel sequence={sequence} action={headerAction} />;
}

function useEdit() {
  const updateSequence = useDiagramStore((state) => state.updateSequence);
  return updateSequence;
}

function OverviewPanel({ sequence, action }: { sequence: SequenceDiagram; action?: ReactNode }) {
  const edit = useEdit();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { participants } = sequence;
  const fromId = participants.some((p) => p.id === from) ? from : (participants[0]?.id ?? "");
  const toId = participants.some((p) => p.id === to) ? to : (participants[1]?.id ?? participants[0]?.id ?? "");

  return (
    <div className={PANEL}>
      <Title action={action}>Sequence</Title>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-zinc-700 dark:text-zinc-200">
        <span>
          Number the messages
          <span className="block text-xs text-zinc-500">1, 2, 3… in the order they happen</span>
        </span>
        <input
          type="checkbox"
          checked={sequence.numbered !== false}
          onChange={(event) =>
            edit((current) => {
              const next = { ...current };
              if (event.target.checked) delete next.numbered;
              else next.numbered = false;
              return next;
            })
          }
          className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
        />
      </label>
      {participants.length > 0 && (
        <div className={FIELD_LABEL}>
          Add a message at the end
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <select aria-label="From" className={FIELD} value={fromId} onChange={(event) => setFrom(event.target.value)}>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.label}
                </option>
              ))}
            </select>
            <span aria-hidden>→</span>
            <select aria-label="To" className={FIELD} value={toId} onChange={(event) => setTo(event.target.value)}>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={`${ACTION_BUTTON} self-start`}
            onClick={() => {
              const message = newMessage(fromId, toId);
              edit((current) => addStep(current, message));
              selectSequenceItem(message.id);
              requestAnimationFrame(() => document.getElementById(SEQUENCE_LABEL_FIELD_ID)?.focus());
            }}
          >
            Add message
          </button>
        </div>
      )}
      <div className="flex gap-2.5 rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        <Icon name="cursor" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Drag from one lifeline (the dashed line under a participant) to another to add a message there; drag back onto the
          same one for a call to itself. Click a participant, message or note to edit it.
        </p>
      </div>
    </div>
  );
}

function MoveButtons({ labels, canBack, canForward, onBack, onForward }: { labels: [string, string]; canBack: boolean; canForward: boolean; onBack: () => void; onForward: () => void }) {
  return (
    <div className="flex gap-1.5">
      <button type="button" className={ACTION_BUTTON} disabled={!canBack} onClick={onBack}>
        {labels[0]}
      </button>
      <button type="button" className={ACTION_BUTTON} disabled={!canForward} onClick={onForward}>
        {labels[1]}
      </button>
    </div>
  );
}

function ParticipantPanel({ sequence, participant, index, action }: { sequence: SequenceDiagram; participant: SequenceParticipant; index: number; action?: ReactNode }) {
  const edit = useEdit();
  const legend = useDiagramStore((state) => state.diagram.legend);
  const diagram = useDiagramStore((state) => state.diagram);
  const groups = linkableComponents(diagram);
  const link = participant.component;
  const linkedTab = link ? diagram.sections.find((section) => section.id === link.sectionId) : undefined;
  const messages = sequence.steps.filter((step) => step.type === "message" && (step.from === participant.id || step.to === participant.id)).length;
  const key = `participant:${participant.id}`;

  return (
    <div className={PANEL}>
      <Title action={action}>{participant.shape === "actor" ? "Actor" : "Participant"}</Title>
      {groups.length > 0 && (
        <label className={FIELD_LABEL}>
          Stands for
          <select
            className={FIELD}
            value={link ? `${link.sectionId}/${link.id}` : ""}
            onChange={(event) => {
              const [sectionId, id] = event.target.value.split("/");
              const component = groups.find((group) => group.section.id === sectionId)?.components.find((node) => node.id === id);
              edit((current) =>
                updateParticipant(current, participant.id, component ? { component: { sectionId, id }, label: component.data.label, colorKey: component.data.colorKey } : { component: undefined }),
              );
            }}
          >
            <option value="">Nothing: just a name</option>
            {groups.map(({ section, components }) => (
              <optgroup key={section.id} label={section.name}>
                {components.map((component) => (
                  <option key={component.id} value={`${section.id}/${component.id}`}>
                    {component.data.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className={HINT}>
            {link
              ? "Its name and colour follow the component: rename or recolour it there."
              : "Pick a component from your architecture to keep the names in step."}
          </span>
          {link && linkedTab && (
            <button
              type="button"
              className={`${ACTION_BUTTON} self-start`}
              onClick={() => goTo({ sectionId: link.sectionId, kind: "node", id: link.id })}
            >
              Show it on {linkedTab.name}
            </button>
          )}
        </label>
      )}
      <label className={FIELD_LABEL}>
        Name
        <input
          id={SEQUENCE_LABEL_FIELD_ID}
          className={`${FIELD} read-only:bg-zinc-50 read-only:text-zinc-500 dark:read-only:bg-zinc-950`}
          readOnly={!!link}
          value={participant.label}
          onChange={(event) => edit((current) => updateParticipant(current, participant.id, { label: event.target.value }), `${key}:label`)}
          onBlur={(event) => {
            if (!event.target.value.trim()) edit((current) => updateParticipant(current, participant.id, { label: "Participant" }));
          }}
        />
      </label>
      <div className={FIELD_LABEL}>
        Shown as
        <div role="radiogroup" aria-label="Shown as" className="flex rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700">
          {(["participant", "actor"] as const).map((shape) => {
            const active = (participant.shape ?? "participant") === shape;
            return (
              <button
                key={shape}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => edit((current) => updateParticipant(current, participant.id, { shape: shape === "actor" ? "actor" : undefined }))}
                className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium ${
                  active ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {shape === "actor" ? "Person" : "Box"}
              </button>
            );
          })}
        </div>
      </div>
      {!link && (
        <div className={FIELD_LABEL}>
          Color
          <div className="flex flex-wrap gap-1.5">
            {legend.map((entry) => {
              const active = participant.colorKey === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  aria-label={entry.label}
                  aria-pressed={active}
                  title={entry.label}
                  onClick={() => edit((current) => updateParticipant(current, participant.id, { colorKey: active ? undefined : entry.key }))}
                  className={`h-6 w-6 rounded border ${active ? "border-zinc-900 ring-2 ring-zinc-900/30 dark:border-zinc-100" : "border-black/15"}`}
                  style={{ backgroundColor: entry.color }}
                />
              );
            })}
          </div>
          <span className={HINT}>The same categories as your components. Click again to clear.</span>
        </div>
      )}
      <label className={FIELD_LABEL}>
        Description
        <textarea
          rows={2}
          className={`${FIELD} resize-y`}
          placeholder="Its role in this flow"
          value={participant.description ?? ""}
          onChange={(event) =>
            edit((current) => updateParticipant(current, participant.id, { description: event.target.value.trim() ? event.target.value : undefined }), `${key}:description`)
          }
        />
      </label>
      <div className={FIELD_LABEL}>
        Position
        <MoveButtons
          labels={["← Move left", "Move right →"]}
          canBack={index > 0}
          canForward={index < sequence.participants.length - 1}
          onBack={() => edit((current) => moveParticipant(current, participant.id, index - 1))}
          onForward={() => edit((current) => moveParticipant(current, participant.id, index + 1))}
        />
        <span className={HINT}>Or select it and press ← / →.</span>
      </div>
      <button
        type="button"
        className={`${DELETE_BUTTON} self-start`}
        title={messages ? `Its ${messages} message${messages === 1 ? "" : "s"} go too` : undefined}
        onClick={() => {
          edit((current) => removeParticipant(current, participant.id));
          selectSequenceItem(null);
        }}
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
        Delete {participant.shape === "actor" ? "actor" : "participant"}
        {messages ? ` and ${messages} message${messages === 1 ? "" : "s"}` : ""}
      </button>
    </div>
  );
}

function ParticipantSelect({ label, value, sequence, onChange }: { label: string; value: string; sequence: SequenceDiagram; onChange: (id: string) => void }) {
  return (
    <label className={FIELD_LABEL}>
      {label}
      <select className={FIELD} value={value} onChange={(event) => onChange(event.target.value)}>
        {sequence.participants.map((participant) => (
          <option key={participant.id} value={participant.id}>
            {participant.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StepFooter({ sequence, id, index, noun }: { sequence: SequenceDiagram; id: string; index: number; noun: string }) {
  const edit = useEdit();
  return (
    <>
      <div className={FIELD_LABEL}>
        Order
        <MoveButtons
          labels={["↑ Earlier", "Later ↓"]}
          canBack={index > 0}
          canForward={index < sequence.steps.length - 1}
          onBack={() => edit((current) => moveStep(current, id, index - 1))}
          onForward={() => edit((current) => moveStep(current, id, index + 1))}
        />
        <span className={HINT}>Or select it and press ↑ / ↓.</span>
      </div>
      <button
        type="button"
        className={`${DELETE_BUTTON} self-start`}
        onClick={() => {
          edit((current) => removeStep(current, id));
          selectSequenceItem(null);
        }}
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
        Delete {noun}
      </button>
    </>
  );
}

function MessagePanel({ sequence, message, index, action }: { sequence: SequenceDiagram; message: SequenceMessage; index: number; action?: ReactNode }) {
  const edit = useEdit();
  const key = `message:${message.id}`;
  const kind = message.kind ?? "call";
  return (
    <div className={PANEL}>
      <Title action={action}>Message</Title>
      <label className={FIELD_LABEL}>
        What&apos;s sent
        <input
          id={SEQUENCE_LABEL_FIELD_ID}
          className={FIELD}
          placeholder="e.g. Place order, OrderCreated"
          value={message.label ?? ""}
          onChange={(event) => edit((current) => updateStep(current, message.id, { label: event.target.value }), `${key}:label`)}
        />
      </label>
      <label className={FIELD_LABEL}>
        Protocol or technology
        <input
          className={FIELD}
          placeholder="e.g. REST, gRPC, Kafka"
          value={message.protocol ?? ""}
          onChange={(event) => edit((current) => updateStep(current, message.id, { protocol: event.target.value }), `${key}:protocol`)}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <ParticipantSelect label="From" value={message.from} sequence={sequence} onChange={(from) => edit((current) => updateStep(current, message.id, { from }))} />
        <ParticipantSelect label="To" value={message.to} sequence={sequence} onChange={(to) => edit((current) => updateStep(current, message.id, { to }))} />
      </div>
      <div className={FIELD_LABEL}>
        Type
        <div role="radiogroup" aria-label="Type" className="flex rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700">
          {KIND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={kind === option.value}
              title={option.hint}
              onClick={() => edit((current) => updateStep(current, message.id, { kind: option.value === "call" ? undefined : option.value }))}
              className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium ${
                kind === option.value ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className={HINT}>{KIND_OPTIONS.find((option) => option.value === kind)?.hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={ACTION_BUTTON}
          title="Add the reply to this call just after it"
          onClick={() => {
            const reply = newMessage(message.to, message.from, { kind: "reply" });
            edit((current) => addStep(current, reply, index + 1));
            selectSequenceItem(reply.id);
            requestAnimationFrame(() => document.getElementById(SEQUENCE_LABEL_FIELD_ID)?.focus());
          }}
        >
          Add reply
        </button>
        <button type="button" className={ACTION_BUTTON} onClick={() => edit((current) => updateStep(current, message.id, { from: message.to, to: message.from }))}>
          Reverse
        </button>
      </div>
      <StepFooter sequence={sequence} id={message.id} index={index} noun="message" />
    </div>
  );
}

function NotePanel({ sequence, note, index, action }: { sequence: SequenceDiagram; note: SequenceNote; index: number; action?: ReactNode }) {
  const edit = useEdit();
  const [first, last] = note.over;
  return (
    <div className={PANEL}>
      <Title action={action}>Note</Title>
      <label className={FIELD_LABEL}>
        Text
        <textarea
          id={SEQUENCE_LABEL_FIELD_ID}
          rows={3}
          className={`${FIELD} field-sizing-content min-h-20 resize-y`}
          value={note.text}
          onChange={(event) => edit((current) => updateStep(current, note.id, { text: event.target.value }), `note:${note.id}:text`)}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <ParticipantSelect label="Over" value={first} sequence={sequence} onChange={(id) => edit((current) => updateStep(current, note.id, { over: last && last !== id ? [id, last] : [id] }))} />
        <label className={FIELD_LABEL}>
          Through
          <select
            className={FIELD}
            value={last ?? ""}
            onChange={(event) => edit((current) => updateStep(current, note.id, { over: event.target.value && event.target.value !== first ? [first, event.target.value] : [first] }))}
          >
            <option value="">Just that one</option>
            {sequence.participants
              .filter((participant) => participant.id !== first)
              .map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.label}
                </option>
              ))}
          </select>
        </label>
      </div>
      <StepFooter sequence={sequence} id={note.id} index={index} noun="note" />
    </div>
  );
}
