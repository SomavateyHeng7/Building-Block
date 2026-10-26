"use client";

import { useReactFlow } from "@xyflow/react";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { nextSlotInContainer } from "@/lib/diagram/layout";
import {
  addParticipant,
  addStep,
  findLinkable,
  linkableComponents,
  linkKey,
  newNote,
  newParticipant,
  participantFor,
} from "@/lib/diagram/sequence";
import type { BlockColorKey, SequenceParticipant } from "@/lib/diagram/types";
import { showDetails } from "./detailsPanel";
import { SEQUENCE_LABEL_FIELD_ID, findSequenceItem, selectSequenceItem, useSequenceSelection } from "./sequenceSelection";
import { Icon } from "./Icon";
import PanelToggle from "./PanelToggle";

export const PALETTE_DATA_FORMAT = "application/building-block-node";

const HEADING_TEXT = "flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-500";
const HEADING = `mb-2 ${HEADING_TEXT}`;
const KBD =
  "rounded border border-zinc-200 px-1.5 font-mono text-[10px] font-medium normal-case text-zinc-400 dark:border-zinc-700";
const ITEM =
  "group flex cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:border-zinc-200 hover:bg-zinc-50 focus-visible:border-zinc-300 focus-visible:outline-none active:cursor-grabbing pointer-coarse:py-2.5 dark:text-zinc-200 dark:hover:border-zinc-800 dark:hover:bg-zinc-900";
const GRIP = "h-4 w-4 shrink-0 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600";

export type PaletteDragPayload =
  | { kind: "container" }
  | { kind: "block"; colorKey: string };

function startDrag(event: React.DragEvent, payload: PaletteDragPayload) {
  event.dataTransfer.setData(PALETTE_DATA_FORMAT, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "move";
}

interface SidebarProps {
  className?: string;
  /** Called after a tap adds something, so a drawer can get out of the way. */
  onAdded?: () => void;
  /** Collapses the panel on wide screens. */
  onCollapse?: () => void;
}

export default function Sidebar({ className = "", onAdded, onCollapse }: SidebarProps) {
  const legend = useDiagramStore((state) => state.diagram.legend);
  const addContainer = useDiagramStore((state) => state.addContainer);
  const addBlock = useDiagramStore((state) => state.addBlock);
  const { screenToFlowPosition } = useReactFlow();
  const sequence = useDiagramStore((state) => getActiveSection(state.diagram).sequence);
  const sections = useDiagramStore((state) => state.diagram.sections);
  const updateSequence = useDiagramStore((state) => state.updateSequence);

  /** Touch screens can't drag from here, so tapping adds at the middle of what's on screen. */
  function canvasCenter() {
    const pane = document.querySelector(".react-flow")?.getBoundingClientRect();
    return screenToFlowPosition({
      x: pane ? pane.left + pane.width / 2 : window.innerWidth / 2,
      y: pane ? pane.top + pane.height / 2 : window.innerHeight / 2,
    });
  }

  function tapAddContainer() {
    const center = canvasCenter();
    addContainer({ x: center.x - 160, y: center.y - 32 });
    onAdded?.();
  }

  function tapAddBlock(colorKey: BlockColorKey) {
    const { diagram, selectedNodeIds } = useDiagramStore.getState();
    const nodes = getActiveSection(diagram).nodes;
    const selected = selectedNodeIds.length === 1 ? nodes.find((node) => node.id === selectedNodeIds[0]) : undefined;
    const containerId = selected?.type === "container" ? selected.id : selected?.parentId;
    if (containerId) {
      addBlock(nextSlotInContainer(nodes, containerId), containerId, colorKey);
    } else {
      const center = canvasCenter();
      addBlock({ x: center.x - 70, y: center.y - 28 }, null, colorKey);
    }
    onAdded?.();
  }

  function itemProps(add: () => void, payload: PaletteDragPayload) {
    return {
      role: "button",
      tabIndex: 0,
      draggable: true,
      onDragStart: (event: React.DragEvent) => startDrag(event, payload),
      onClick: add,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          add();
        }
      },
    } as const;
  }

  if (sequence) {
    /** Adds a participant at the end (or a note under the selected participant), then opens it for naming. */
    const add = (participant: SequenceParticipant) => {
      updateSequence((current) => addParticipant(current, participant));
      selectSequenceItem(participant.id);
      showDetails(SEQUENCE_LABEL_FIELD_ID);
      onAdded?.();
    };
    const addNote = () => {
      const selected = findSequenceItem(sequence, useSequenceSelection.getState().id);
      const over =
        selected?.kind === "participant"
          ? selected.participant.id
          : selected?.step.type === "message"
            ? selected.step.from
            : sequence.participants[0]?.id;
      if (!over) return;
      const note = newNote([over], "");
      // Just after the selected step, or at the end.
      const at = selected?.kind === "step" ? selected.index + 1 : sequence.steps.length;
      updateSequence((current) => addStep(current, note, at));
      selectSequenceItem(note.id);
      showDetails(SEQUENCE_LABEL_FIELD_ID);
      onAdded?.();
    };
    const button = (onClick: () => void) => ({
      type: "button" as const,
      onClick,
      className: `${ITEM} w-full cursor-pointer text-left`,
    });
    return (
      <aside className={`flex flex-col gap-5 overflow-y-auto border-r border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 ${className}`}>
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className={`${HEADING_TEXT} flex-1`}>Participants</h2>
            {onCollapse && <PanelToggle side="left" expanded label="the components panel" onClick={onCollapse} />}
          </div>
          <div className="flex flex-col gap-1">
            <button {...button(() => add(newParticipant("User", "actor")))}>
              <Icon name="user" className="h-5 w-7 shrink-0 text-zinc-500" />
              <span className="flex-1 truncate">Actor (person)</span>
            </button>
            <button {...button(() => add(newParticipant("New participant")))}>
              <span aria-hidden className="h-5 w-7 shrink-0 rounded border border-dashed border-zinc-400 dark:border-zinc-500" />
              <span className="flex-1 truncate">Participant</span>
            </button>
            {legend.map((entry) => (
              <button key={entry.key} {...button(() => add(newParticipant(entry.label, "participant", entry.key)))}>
                <span aria-hidden className="h-5 w-7 shrink-0 rounded border border-black/15 dark:border-white/15" style={{ backgroundColor: entry.color }} />
                <span className="flex-1 truncate" title={entry.label}>{entry.label}</span>
              </button>
            ))}
          </div>
        </section>
        {(() => {
          // Components from the architecture tabs that aren't in this sequence yet.
          const used = new Set(sequence.participants.flatMap((participant) => (participant.component ? [linkKey(participant.component)] : [])));
          const groups = linkableComponents({ sections })
            .map((group) => ({
              ...group,
              components: group.components.filter((component) => !used.has(linkKey({ sectionId: group.section.id, id: component.id }))),
            }))
            .filter((group) => group.components.length);
          if (!groups.length) return null;
          return (
            <section>
              <h2 className={HEADING}>From your architecture</h2>
              <select
                aria-label="Add a component from your architecture"
                value=""
                onChange={(event) => {
                  const found = findLinkable(groups, event.target.value);
                  if (found) add(participantFor(found.sectionId, found.component));
                }}
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Add a component…</option>
                {groups.map(({ section, components }) => (
                  <optgroup key={section.id} label={section.name}>
                    {components.map((component) => (
                      <option key={component.id} value={linkKey({ sectionId: section.id, id: component.id })}>
                        {component.data.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">Keeps its name and colour in step with the component.</p>
            </section>
          );
        })()}
        <section>
          <h2 className={HEADING}>Steps</h2>
          <button {...button(addNote)} disabled={!sequence.participants.length}>
            <span aria-hidden className="h-5 w-7 shrink-0 rounded-sm border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" />
            <span className="flex-1 truncate">Note</span>
          </button>
        </section>
        <p className="mt-auto rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          Click to add. To add a message, drag from one participant&apos;s dashed lifeline to another&apos;s.
        </p>
      </aside>
    );
  }

  return (
    <aside className={`flex flex-col gap-5 overflow-y-auto border-r border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 ${className}`}>
      <section>
        {/* The collapse button shares the panel's first line. */}
        <div className="mb-2 flex items-center gap-2">
          <h2 className={`${HEADING_TEXT} flex-1`}>
            Containers
            <kbd className={KBD} title="Keyboard shortcut">C</kbd>
          </h2>
          {onCollapse && <PanelToggle side="left" expanded label="the components panel" onClick={onCollapse} />}
        </div>
        <div {...itemProps(tapAddContainer, { kind: "container" })} className={ITEM}>
          <span aria-hidden className="h-5 w-7 shrink-0 rounded border-2 border-dashed border-zinc-400 dark:border-zinc-500" />
          <span className="flex-1 truncate">Container</span>
          <Icon name="grip" className={GRIP} />
        </div>
      </section>

      <section>
        <h2 className={HEADING}>
          Components
          <kbd className={KBD} title="Keyboard shortcut">B</kbd>
        </h2>
        <div className="flex flex-col gap-1">
          {legend.length === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-xs leading-snug text-zinc-500 dark:border-zinc-700">
              Add a legend entry to get a component for it.
            </p>
          )}
          {legend.map((entry) => (
            <div key={entry.key} {...itemProps(() => tapAddBlock(entry.key), { kind: "block", colorKey: entry.key })} className={ITEM}>
              <span
                aria-hidden
                className="h-5 w-7 shrink-0 rounded border border-black/15 dark:border-white/15"
                style={{ backgroundColor: entry.color }}
              />
              <span className="flex-1 truncate" title={entry.label}>{entry.label}</span>
              <Icon name="grip" className={GRIP} />
            </div>
          ))}
        </div>
      </section>

      <p className="mt-auto rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        Drag onto the canvas or click to add. Drop a component on a container, or select the container first, to put it inside.
      </p>
    </aside>
  );
}
