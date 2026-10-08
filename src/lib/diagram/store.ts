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
import type {
  BlockColorKey,
  ConnectionSide,
  ContainerStyle,
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramSection,
  LegendEntry,
  NodeDetails,
  Position,
} from "./types";

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

/** Applies a change to the active section as a whole (nodes and connections together). */
function mapActiveSectionFull(diagram: Diagram, fn: (section: DiagramSection) => DiagramSection): Diagram {
  const sections = diagram.sections.map((section) => (section.id === diagram.activeSectionId ? fn(section) : section));
  return touch({ ...diagram, sections });
}

/** Connections are dropped with the components they join. */
function withoutDanglingEdges(section: DiagramSection): DiagramSection {
  if (!section.edges?.length) return section;
  const ids = new Set(section.nodes.map((node) => node.id));
  const edges = section.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  return edges.length === section.edges.length ? section : { ...section, edges };
}

/** Connections whose two ends are both in `idMap`, copied onto the new ids. */
function copyEdges(edges: DiagramEdge[] | undefined, idMap: Map<string, string>): DiagramEdge[] {
  return (edges ?? [])
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge) => ({ ...edge, id: createId("edge"), source: idMap.get(edge.source)!, target: idMap.get(edge.target)! }));
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
  const edgeStillThere = (getActiveSection(restored).edges ?? []).some((edge) => edge.id === state.selectedEdgeId);
  return {
    diagram: restored,
    selectedNodeIds: keepExisting(restored, state.selectedNodeIds),
    selectedEdgeId: edgeStillThere ? state.selectedEdgeId : null,
  };
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
let clipboardEdges: DiagramEdge[] = [];
let pasteCount = 0;
const PASTE_OFFSET = 24;

function toClipboard(nodes: DiagramNode[], ids: string[]): ClipboardEntry[] {
  return withDescendants(nodes, ids).map((node) => ({ node, absolute: absolutePosition(node, nodes) }));
}

/** Gives clipboard nodes fresh ids, offsets them, and re-attaches them to a parent where possible. */
function materialize(
  entries: ClipboardEntry[],
  current: DiagramNode[],
  offset: number,
): { nodes: DiagramNode[]; idMap: Map<string, string> } {
  const idMap = new Map(entries.map(({ node }) => [node.id, createId(node.type)]));
  const nodes = entries.map(({ node, absolute }) => {
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
  return { nodes, idMap };
}

export interface NewConnection {
  source: string;
  target: string;
  sourceSide?: ConnectionSide;
  targetSide?: ConnectionSide;
}

export type ConnectionPatch = Partial<Omit<DiagramEdge, "id" | "source" | "target">>;

export interface NodesChangeOptions {
  coalesceKey?: string;
}

interface DiagramState {
  diagram: Diagram;
  selectedNodeIds: string[];
  /** A selected connection; never set together with selected nodes. */
  selectedEdgeId: string | null;
  past: Diagram[];
  future: Diagram[];
  undo: () => void;
  redo: () => void;
  loadDiagram: (diagram: Diagram) => void;
  renameDiagram: (name: string) => void;
  setSelection: (ids: string[]) => void;
  setSelectedEdge: (id: string | null) => void;
  /** Joins two components; returns the new connection's id, or null when it isn't allowed or already exists. */
  addConnection: (connection: NewConnection) => string | null;
  updateConnection: (id: string, patch: ConnectionPatch) => void;
  reverseConnection: (id: string) => void;
  deleteConnections: (ids: string[]) => void;
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
  selectedEdgeId: null,
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
    set({ diagram, selectedNodeIds: [], selectedEdgeId: null, past: [], future: [] });
  },

  renameDiagram: (name) =>
    set((state) => commit(state, touch({ ...state.diagram, name }), "rename-diagram")),

  setSelection: (ids) =>
    set((state) => ({ selectedNodeIds: ids, selectedEdgeId: ids.length ? null : state.selectedEdgeId })),

  setSelectedEdge: (id) => set((state) => ({ selectedEdgeId: id, selectedNodeIds: id ? [] : state.selectedNodeIds })),

  addConnection: ({ source, target, sourceSide, targetSide }) => {
    const { diagram } = useDiagramStore.getState();
    const section = getActiveSection(diagram);
    const isBlock = (id: string) => section.nodes.some((node) => node.id === id && node.type === "block");
    if (source === target || !isBlock(source) || !isBlock(target)) return null;
    const exists = (section.edges ?? []).some(
      (edge) =>
        edge.source === source &&
        edge.target === target &&
        edge.sourceSide === sourceSide &&
        edge.targetSide === targetSide,
    );
    if (exists) return null;
    const id = createId("edge");
    const edge: DiagramEdge = { id, source, target, ...(sourceSide ? { sourceSide } : {}), ...(targetSide ? { targetSide } : {}) };
    set((state) => ({
      ...commit(
        state,
        mapActiveSectionFull(state.diagram, (current) => ({ ...current, edges: [...(current.edges ?? []), edge] })),
      ),
      selectedEdgeId: id,
      selectedNodeIds: [],
    }));
    return id;
  },

  // Blank text is stored as undefined so it drops out of saved JSON.
  updateConnection: (id, patch) =>
    set((state) => {
      const cleaned = Object.fromEntries(
        Object.entries(patch).map(([field, value]) => [field, typeof value === "string" && !value.trim() ? undefined : value]),
      ) as ConnectionPatch;
      return commit(
        state,
        mapActiveSectionFull(state.diagram, (section) => ({
          ...section,
          edges: (section.edges ?? []).map((edge) => (edge.id === id ? { ...edge, ...cleaned } : edge)),
        })),
        `edge:${id}:${Object.keys(patch).join(",")}`,
      );
    }),

  reverseConnection: (id) =>
    set((state) =>
      commit(
        state,
        mapActiveSectionFull(state.diagram, (section) => ({
          ...section,
          edges: (section.edges ?? []).map((edge) =>
            edge.id === id
              ? {
                  ...edge,
                  source: edge.target,
                  target: edge.source,
                  sourceSide: edge.targetSide,
                  targetSide: edge.sourceSide,
                }
              : edge,
          ),
        })),
      ),
    ),

  deleteConnections: (ids) =>
    set((state) => {
      const doomed = new Set(ids);
      const present = (getActiveSection(state.diagram).edges ?? []).some((edge) => doomed.has(edge.id));
      if (!present) return state;
      return {
        ...commit(
          state,
          mapActiveSectionFull(state.diagram, (section) => ({
            ...section,
            edges: (section.edges ?? []).filter((edge) => !doomed.has(edge.id)),
          })),
        ),
        selectedEdgeId: state.selectedEdgeId && doomed.has(state.selectedEdgeId) ? null : state.selectedEdgeId,
      };
    }),

  selectAll: () =>
    set((state) => ({ selectedNodeIds: getActiveSection(state.diagram).nodes.map((node) => node.id) })),

  copySelection: () => {
    const { diagram, selectedNodeIds } = useDiagramStore.getState();
    if (!selectedNodeIds.length) return;
    const section = getActiveSection(diagram);
    clipboard = toClipboard(section.nodes, selectedNodeIds);
    const copied = new Set(clipboard.map(({ node }) => node.id));
    clipboardEdges = (section.edges ?? []).filter((edge) => copied.has(edge.source) && copied.has(edge.target));
    pasteCount = 0;
  },

  paste: () =>
    set((state) => {
      if (!clipboard.length) return state;
      pasteCount += 1;
      const current = getActiveSection(state.diagram).nodes;
      const { nodes: pasted, idMap } = materialize(clipboard, current, PASTE_OFFSET * pasteCount);
      const edges = copyEdges(clipboardEdges, idMap);
      return {
        ...commit(
          state,
          mapActiveSectionFull(state.diagram, (section) => ({
            ...section,
            nodes: [...section.nodes, ...pasted],
            ...(edges.length ? { edges: [...(section.edges ?? []), ...edges] } : {}),
          })),
        ),
        selectedNodeIds: pasted.map((node) => node.id),
        selectedEdgeId: null,
      };
    }),

  // Like copy + paste, but leaves the clipboard alone.
  duplicateSelection: () =>
    set((state) => {
      const current = getActiveSection(state.diagram).nodes;
      if (!state.selectedNodeIds.length) return state;
      const { nodes: copies, idMap } = materialize(toClipboard(current, state.selectedNodeIds), current, PASTE_OFFSET);
      const edges = copyEdges(getActiveSection(state.diagram).edges, idMap);
      return {
        ...commit(
          state,
          mapActiveSectionFull(state.diagram, (section) => ({
            ...section,
            nodes: [...section.nodes, ...copies],
            ...(edges.length ? { edges: [...(section.edges ?? []), ...edges] } : {}),
          })),
        ),
        selectedNodeIds: copies.map((node) => node.id),
        selectedEdgeId: null,
      };
    }),

  deleteNodes: (ids) =>
    set((state) => {
      const removed = new Set(withDescendants(getActiveSection(state.diagram).nodes, ids).map((n) => n.id));
      if (!removed.size) return state;
      return {
        ...commit(
          state,
          mapActiveSectionFull(state.diagram, (section) =>
            withoutDanglingEdges({ ...section, nodes: section.nodes.filter((node) => !removed.has(node.id)) }),
          ),
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
    set((state) =>
      commit(
        state,
        mapActiveSectionFull(state.diagram, (section) => withoutDanglingEdges({ ...section, nodes })),
        options?.coalesceKey,
      ),
    ),

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
        ? { diagram: { ...state.diagram, activeSectionId: id }, selectedNodeIds: [], selectedEdgeId: null }
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
        selectedEdgeId: null,
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
        selectedEdgeId: activeSectionId === id ? null : state.selectedEdgeId,
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
        ...(source.edges?.length ? { edges: copyEdges(source.edges, idMap) } : {}),
      };
      const index = state.diagram.sections.findIndex((section) => section.id === id);
      const sections = [...state.diagram.sections];
      sections.splice(index + 1, 0, copy);
      return {
        ...commit(state, touch({ ...state.diagram, sections, activeSectionId: copy.id })),
        selectedNodeIds: [],
        selectedEdgeId: null,
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
