import { create } from "zustand";
import { createBlankDiagram, createBlankSection, createId } from "./factory";
import {
  absolutePosition,
  arrangeNodes,
  fitContainerToContents,
  growContainerToFit,
  restyleContainer,
  tidyContainer,
  type ArrangeOp,
} from "./layout";
import type { BlockColorKey, ContainerStyle, Diagram, DiagramNode, LegendEntry, NodeDetails, Position } from "./types";

function touch(diagram: Diagram): Diagram {
  return { ...diagram, updatedAt: new Date().toISOString() };
}

function mapActiveSection(
  diagram: Diagram,
  fn: (nodes: DiagramNode[]) => DiagramNode[],
): Diagram {
  const sections = diagram.sections.map((section) =>
    section.id === diagram.activeSectionId ? { ...section, nodes: fn(section.nodes) } : section,
  );
  return touch({ ...diagram, sections });
}

const HISTORY_LIMIT = 100;
/** Edits sharing a coalesce key within this window collapse into one undo step. */
const COALESCE_MS = 800;

let lastCommit: { key: string | null; at: number } = { key: null, at: 0 };

/**
 * Applies a diagram change and records the previous diagram for undo.
 * Pass a coalesceKey for bursts of edits (drags, typing) so they undo as one step.
 */
function commit(state: DiagramState, diagram: Diagram, coalesceKey?: string) {
  const now = Date.now();
  const coalesce =
    coalesceKey !== undefined && coalesceKey === lastCommit.key && now - lastCommit.at < COALESCE_MS;
  lastCommit = { key: coalesceKey ?? null, at: now };
  return {
    diagram,
    past: coalesce ? state.past : [...state.past, state.diagram].slice(-HISTORY_LIMIT),
    future: [],
  };
}

/** Drops selected ids that no longer exist in the diagram's active section. */
function keepExisting(diagram: Diagram, ids: string[]): string[] {
  const nodes = getActiveSection(diagram).nodes;
  return ids.filter((id) => nodes.some((node) => node.id === id));
}

function restore(state: DiagramState, diagram: Diagram) {
  lastCommit = { key: null, at: 0 };
  const restored = touch(diagram);
  return { diagram: restored, selectedNodeIds: keepExisting(restored, state.selectedNodeIds) };
}

/** Selected nodes plus the children of selected containers. */
function withDescendants(nodes: DiagramNode[], ids: string[]): DiagramNode[] {
  const included = new Set(ids);
  for (const node of nodes) if (node.parentId && included.has(node.parentId)) included.add(node.id);
  return nodes.filter((node) => included.has(node.id));
}

interface ClipboardEntry {
  node: DiagramNode;
  /** Canvas position at copy time, used when the original parent isn't available on paste. */
  absolute: Position;
}

let clipboard: ClipboardEntry[] = [];
let pasteCount = 0;
const PASTE_OFFSET = 24;

function toClipboard(nodes: DiagramNode[], ids: string[]): ClipboardEntry[] {
  return withDescendants(nodes, ids).map((node) => ({ node, absolute: absolutePosition(node, nodes) }));
}

/** Gives clipboard nodes fresh ids, offsets them, and re-attaches them to a parent where possible. */
function materialize(entries: ClipboardEntry[], current: DiagramNode[], offset: number): DiagramNode[] {
  const idMap = new Map(entries.map(({ node }) => [node.id, createId(node.type)]));
  return entries.map(({ node, absolute }) => {
    const copiedParent = node.parentId ? idMap.get(node.parentId) : undefined;
    const existingParent =
      !copiedParent && node.parentId && current.some((candidate) => candidate.id === node.parentId)
        ? node.parentId
        : undefined;
    const parentId = copiedParent ?? existingParent;
    const position = copiedParent
      ? node.position
      : existingParent
        ? { x: node.position.x + offset, y: node.position.y + offset }
        : { x: absolute.x + offset, y: absolute.y + offset };
    return {
      ...node,
      id: idMap.get(node.id)!,
      parentId,
      position,
      data: node.data.kind === "block" ? { ...node.data, containerId: parentId ?? null } : { ...node.data },
    };
  });
}

export interface NodesChangeOptions {
  coalesceKey?: string;
}

interface DiagramState {
  diagram: Diagram;
  selectedNodeIds: string[];
  past: Diagram[];
  future: Diagram[];
  undo: () => void;
  redo: () => void;
  loadDiagram: (diagram: Diagram) => void;
  renameDiagram: (name: string) => void;
  setSelection: (ids: string[]) => void;
  selectAll: () => void;
  copySelection: () => void;
  paste: () => void;
  duplicateSelection: () => void;
  deleteNodes: (ids: string[]) => void;
  arrangeSelection: (op: ArrangeOp) => void;
  fitContainer: (id: string) => void;
  /** Fits every container in the active section that has components. */
  fitAllContainers: () => void;
  tidyContainer: (id: string) => void;
  setShowTechnology: (show: boolean) => void;
  setActiveSectionNodes: (nodes: DiagramNode[], options?: NodesChangeOptions) => void;
  addContainer: (position: Position) => void;
  addBlock: (position: Position, parentId?: string | null, colorKey?: BlockColorKey) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeColor: (id: string, colorKey: BlockColorKey) => void;
  updateNodesColor: (ids: string[], colorKey: BlockColorKey) => void;
  updateNodeDetails: (id: string, patch: NodeDetails) => void;
  updateContainerStyle: (id: string, patch: ContainerStyle) => void;
  updateLegendEntry: (key: BlockColorKey, patch: Partial<LegendEntry>) => void;
  addLegendEntry: () => BlockColorKey;
  removeLegendEntry: (key: BlockColorKey) => void;
  setActiveSection: (id: string) => void;
  addSection: (name?: string) => void;
  renameSection: (id: string, name: string) => void;
  deleteSection: (id: string) => void;
  duplicateSection: (id: string) => void;
}

export const useDiagramStore = create<DiagramState>((set) => ({
  diagram: createBlankDiagram(),
  selectedNodeIds: [],
  past: [],
  future: [],

  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...restore(state, previous),
        past: state.past.slice(0, -1),
        future: [state.diagram, ...state.future],
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...restore(state, next),
        past: [...state.past, state.diagram],
        future: state.future.slice(1),
      };
    }),

  loadDiagram: (diagram) => {
    lastCommit = { key: null, at: 0 };
    set({ diagram, selectedNodeIds: [], past: [], future: [] });
  },

  renameDiagram: (name) =>
    set((state) => commit(state, touch({ ...state.diagram, name }), "rename-diagram")),

  setSelection: (ids) => set({ selectedNodeIds: ids }),

  selectAll: () =>
    set((state) => ({ selectedNodeIds: getActiveSection(state.diagram).nodes.map((node) => node.id) })),

  copySelection: () => {
    const { diagram, selectedNodeIds } = useDiagramStore.getState();
    if (!selectedNodeIds.length) return;
    clipboard = toClipboard(getActiveSection(diagram).nodes, selectedNodeIds);
    pasteCount = 0;
  },

  paste: () =>
    set((state) => {
      if (!clipboard.length) return state;
      pasteCount += 1;
      const current = getActiveSection(state.diagram).nodes;
      const pasted = materialize(clipboard, current, PASTE_OFFSET * pasteCount);
      return {
        ...commit(state, mapActiveSection(state.diagram, (nodes) => [...nodes, ...pasted])),
        selectedNodeIds: pasted.map((node) => node.id),
      };
    }),

  // Like copy + paste, but leaves the clipboard alone.
  duplicateSelection: () =>
    set((state) => {
      const current = getActiveSection(state.diagram).nodes;
      if (!state.selectedNodeIds.length) return state;
      const copies = materialize(toClipboard(current, state.selectedNodeIds), current, PASTE_OFFSET);
      return {
        ...commit(state, mapActiveSection(state.diagram, (nodes) => [...nodes, ...copies])),
        selectedNodeIds: copies.map((node) => node.id),
      };
    }),

  deleteNodes: (ids) =>
    set((state) => {
      const removed = new Set(withDescendants(getActiveSection(state.diagram).nodes, ids).map((n) => n.id));
      if (!removed.size) return state;
      return {
        ...commit(
          state,
          mapActiveSection(state.diagram, (nodes) => nodes.filter((node) => !removed.has(node.id))),
        ),
        selectedNodeIds: state.selectedNodeIds.filter((id) => !removed.has(id)),
      };
    }),

  arrangeSelection: (op) =>
    set((state) =>
      state.selectedNodeIds.length < 2
        ? state
        : commit(
            state,
            mapActiveSection(state.diagram, (nodes) => arrangeNodes(nodes, state.selectedNodeIds, op)),
          ),
    ),

  fitContainer: (id) =>
    set((state) =>
      commit(state, mapActiveSection(state.diagram, (nodes) => fitContainerToContents(nodes, id))),
    ),

  fitAllContainers: () =>
    set((state) =>
      commit(
        state,
        mapActiveSection(state.diagram, (nodes) =>
          nodes
            .filter((node) => node.type === "container")
            .reduce((current, container) => fitContainerToContents(current, container.id), nodes),
        ),
      ),
    ),

  tidyContainer: (id) =>
    set((state) => commit(state, mapActiveSection(state.diagram, (nodes) => tidyContainer(nodes, id)))),

  setShowTechnology: (show) =>
    set((state) => commit(state, touch({ ...state.diagram, showTechnology: show }))),

  setActiveSectionNodes: (nodes, options) =>
    set((state) => commit(state, mapActiveSection(state.diagram, () => nodes), options?.coalesceKey)),

  addContainer: (position) =>
    set((state) => {
      const id = createId("container");
      return {
        ...commit(
          state,
          mapActiveSection(state.diagram, (nodes) => [
            ...nodes,
            {
              id,
              type: "container",
              position,
              size: { width: 320, height: 220 },
              data: { kind: "container", label: "New Container" },
            },
          ]),
        ),
        selectedNodeIds: [id],
      };
    }),

  // Adding into a container grows the container so the new block is never clipped.
  addBlock: (position, parentId = null, colorKey) =>
    set((state) => {
      const id = createId("block");
      return {
        ...commit(
          state,
          mapActiveSection(state.diagram, (nodes) => {
            const added: DiagramNode[] = [
              ...nodes,
              {
                id,
                type: "block",
                position,
                size: { width: 140, height: 56 },
                parentId: parentId ?? undefined,
                data: {
                  kind: "block",
                  label: "New Block",
                  colorKey: colorKey ?? state.diagram.legend[0]?.key,
                  containerId: parentId ?? null,
                },
              },
            ];
            return parentId ? growContainerToFit(added, parentId) : added;
          }),
        ),
        selectedNodeIds: [id],
      };
    }),

  updateNodeLabel: (id, label) =>
    set((state) =>
      commit(
        state,
        mapActiveSection(state.diagram, (nodes) =>
          nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, label } } : node)),
        ),
        `label:${id}`,
      ),
    ),

  updateNodeColor: (id, colorKey) =>
    set((state) =>
      commit(
        state,
        mapActiveSection(state.diagram, (nodes) =>
          nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, colorKey } } : node)),
        ),
      ),
    ),

  updateNodesColor: (ids, colorKey) =>
    set((state) =>
      commit(
        state,
        mapActiveSection(state.diagram, (nodes) =>
          nodes.map((node) => (ids.includes(node.id) ? { ...node, data: { ...node.data, colorKey } } : node)),
        ),
      ),
    ),

  // Blank values are stored as undefined so they drop out of saved JSON.
  updateNodeDetails: (id, patch) =>
    set((state) => {
      const cleaned = Object.fromEntries(
        Object.entries(patch).map(([field, value]) => [field, value?.trim() ? value : undefined]),
      ) as NodeDetails;
      return commit(
        state,
        mapActiveSection(state.diagram, (nodes) =>
          nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...cleaned } } : node)),
        ),
        `details:${id}:${Object.keys(patch).join(",")}`,
      );
    }),

  // Switching tabs is navigation, not an edit, so it isn't recorded.
  setActiveSection: (id) =>
    set((state) =>
      state.diagram.sections.some((section) => section.id === id)
        ? { diagram: { ...state.diagram, activeSectionId: id }, selectedNodeIds: [] }
        : state,
    ),

  addSection: (name) =>
    set((state) => {
      const section = createBlankSection(name ?? `Section ${state.diagram.sections.length + 1}`);
      return {
        ...commit(
          state,
          touch({
            ...state.diagram,
            sections: [...state.diagram.sections, section],
            activeSectionId: section.id,
          }),
        ),
        selectedNodeIds: [],
      };
    }),

  renameSection: (id, name) =>
    set((state) =>
      commit(
        state,
        touch({
          ...state.diagram,
          sections: state.diagram.sections.map((section) =>
            section.id === id ? { ...section, name } : section,
          ),
        }),
      ),
    ),

  deleteSection: (id) =>
    set((state) => {
      const { sections, activeSectionId } = state.diagram;
      if (sections.length <= 1) return state;
      const index = sections.findIndex((section) => section.id === id);
      if (index === -1) return state;
      const remaining = sections.filter((section) => section.id !== id);
      const nextActive =
        activeSectionId === id ? remaining[Math.min(index, remaining.length - 1)].id : activeSectionId;
      return {
        ...commit(state, touch({ ...state.diagram, sections: remaining, activeSectionId: nextActive })),
        selectedNodeIds: activeSectionId === id ? [] : state.selectedNodeIds,
      };
    }),

  duplicateSection: (id) =>
    set((state) => {
      const source = state.diagram.sections.find((section) => section.id === id);
      if (!source) return state;
      const idMap = new Map(source.nodes.map((node) => [node.id, createId(node.type)]));
      const copy = {
        id: createId("section"),
        name: `${source.name} copy`,
        nodes: source.nodes.map((node) => ({
          ...node,
          id: idMap.get(node.id)!,
          parentId: node.parentId ? idMap.get(node.parentId) : undefined,
          data:
            node.data.kind === "block"
              ? { ...node.data, containerId: node.data.containerId ? (idMap.get(node.data.containerId) ?? null) : null }
              : { ...node.data },
        })),
      };
      const index = state.diagram.sections.findIndex((section) => section.id === id);
      const sections = [...state.diagram.sections];
      sections.splice(index + 1, 0, copy);
      return {
        ...commit(state, touch({ ...state.diagram, sections, activeSectionId: copy.id })),
        selectedNodeIds: [],
      };
    }),

  // Keyed by field so dragging the colour picker undoes as one step.
  updateContainerStyle: (id, patch) =>
    set((state) =>
      commit(
        state,
        mapActiveSection(state.diagram, (nodes) => restyleContainer(nodes, id, patch)),
        `style:${id}:${Object.keys(patch).sort().join(",")}`,
      ),
    ),

  updateLegendEntry: (key, patch) =>
    set((state) =>
      commit(
        state,
        touch({
          ...state.diagram,
          legend: state.diagram.legend.map((entry) =>
            entry.key === key ? { ...entry, ...patch } : entry,
          ),
        }),
        `legend:${key}:${Object.keys(patch).join(",")}`,
      ),
    ),

  addLegendEntry: () => {
    const key = createId("legend");
    set((state) => {
      const { legend } = state.diagram;
      const used = new Set(legend.map((entry) => entry.color.toLowerCase()));
      const color =
        NEW_ENTRY_COLORS.find((candidate) => !used.has(candidate)) ??
        NEW_ENTRY_COLORS[legend.length % NEW_ENTRY_COLORS.length];
      return commit(
        state,
        touch({
          ...state.diagram,
          legend: [...legend, { key, label: "New category", color }],
        }),
      );
    });
    return key;
  },

  // Nodes in every section that used the removed entry become unassigned.
  removeLegendEntry: (key) =>
    set((state) =>
      commit(
        state,
        touch({
          ...state.diagram,
          legend: state.diagram.legend.filter((entry) => entry.key !== key),
          sections: state.diagram.sections.map((section) => ({
            ...section,
            nodes: section.nodes.map((node) =>
              node.data.colorKey === key ? { ...node, data: { ...node.data, colorKey: undefined } } : node,
            ),
          })),
        }),
      ),
    ),
}));

const NEW_ENTRY_COLORS = [
  "#60a5fa",
  "#f472b6",
  "#34d399",
  "#fb923c",
  "#a78bfa",
  "#facc15",
  "#2dd4bf",
  "#f87171",
];

export function getActiveSection(diagram: Diagram) {
  return diagram.sections.find((section) => section.id === diagram.activeSectionId) ?? diagram.sections[0];
}
