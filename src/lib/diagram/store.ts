import { create } from "zustand";
import { createBlankDiagram, createBlankSection, createId } from "./factory";
import { nextLegendColor } from "./palette";
import {
  absolutePosition,
  arrangeNodes,
  fitContainerToContents,
  growContainerToFit,
  restyleContainer,
  tidyContainer,
  type ArrangeOp,
} from "./layout";
import type { ComponentIconKey } from "./componentIcons";
import type {
  BlockColorKey,
  ComponentDetail,
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
  return mapActiveSectionFull(diagram, (section) => ({ ...section, nodes: fn(section.nodes) }));
}

/** Internal designs are one level deep, so whatever lands in one can't carry its own. */
function withoutDetail(node: DiagramNode): DiagramNode {
  if (node.data.kind !== "block" || !node.data.detail) return node;
  return { ...node, data: { ...node.data, detail: undefined } };
}

/**
 * Applies a change to the view on screen as a whole (nodes and connections together): the active
 * tab, or the internal design of the component that is open. An emptied internal design is dropped.
 */
function mapActiveSectionFull(diagram: Diagram, fn: (section: DiagramSection) => DiagramSection): Diagram {
  const view = getActiveSection(diagram);
  if (!view.parent) {
    const sections = diagram.sections.map((section) => (section.id === view.id ? fn(section) : section));
    return touch({ ...diagram, sections });
  }
  const { section: owner, component } = view.parent;
  const changed = fn(view);
  const nodes = changed.nodes.map(withoutDetail);
  const detail: ComponentDetail | undefined = nodes.length
    ? { nodes, ...(changed.edges?.length ? { edges: changed.edges } : {}) }
    : undefined;
  const sections = diagram.sections.map((section) =>
    section.id === owner.id
      ? {
          ...section,
          nodes: section.nodes.map((node) =>
            node.id === component.id && node.data.kind === "block" ? { ...node, data: { ...node.data, detail } } : node,
          ),
        }
      : section,
  );
  return touch({ ...diagram, sections });
}

/** Applies `fn` to every node in the diagram, including those inside internal designs. */
function mapEveryNode(diagram: Diagram, fn: (node: DiagramNode) => DiagramNode): DiagramSection[] {
  return diagram.sections.map((section) => ({
    ...section,
    nodes: section.nodes.map((node) => {
      const mapped = fn(node);
      return mapped.data.kind === "block" && mapped.data.detail
        ? { ...mapped, data: { ...mapped.data, detail: { ...mapped.data.detail, nodes: mapped.data.detail.nodes.map(fn) } } }
        : mapped;
    }),
  }));
}

/** Connections are dropped with the components they join. */
function withoutDanglingEdges(section: DiagramSection): DiagramSection {
  if (!section.edges?.length) return section;
  const ids = new Set(section.nodes.map((node) => node.id));
  const edges = section.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  return edges.length === section.edges.length ? section : { ...section, edges };
}

/** Adds pasted or duplicated nodes and connections; containers they landed in grow to fit them. */
function withAdded(section: DiagramSection, added: DiagramNode[], edges: DiagramEdge[]): DiagramSection {
  const parents = new Set(added.flatMap((node) => (node.parentId ? [node.parentId] : [])));
  const nodes = [...parents].reduce((current, id) => growContainerToFit(current, id), [...section.nodes, ...added]);
  return { ...section, nodes, ...(edges.length ? { edges: [...(section.edges ?? []), ...edges] } : {}) };
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

/** The exact earlier diagram, not a copy, so undoing back to what was saved counts as saved. */
function restore(state: DiagramState, restored: Diagram) {
  lastCommit = { key: null, at: 0 };
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
  /** Sets or (with undefined) removes a component's icon. */
  updateNodeIcon: (id: string, icon: ComponentIconKey | undefined) => void;
  updateContainerStyle: (id: string, patch: ContainerStyle) => void;
  updateLegendEntry: (key: BlockColorKey, patch: Partial<LegendEntry>) => void;
  addLegendEntry: () => BlockColorKey;
  removeLegendEntry: (key: BlockColorKey) => void;
  setActiveSection: (id: string) => void;
  /** Opens a component's internal design (L2). Navigation, like switching tabs: not an edit. */
  openDetail: (componentId: string) => void;
  /** Back from an internal design to the tab it belongs to, with its component selected. */
  closeDetail: () => void;
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
          mapActiveSectionFull(state.diagram, (section) => withAdded(section, pasted, edges)),
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
          mapActiveSectionFull(state.diagram, (section) => withAdded(section, copies, edges)),
        ),
        selectedNodeIds: copies.map((node) => node.id),
        selectedEdgeId: null,
      };
    }),

  // Deleting a container keeps its components: they stay where they are on the canvas, no longer inside it.
  deleteNodes: (ids) =>
    set((state) => {
      const nodes = getActiveSection(state.diagram).nodes;
      const removed = new Set(ids.filter((id) => nodes.some((node) => node.id === id)));
      if (!removed.size) return state;
      const kept = nodes
        .filter((node) => !removed.has(node.id))
        .map((node) => {
          if (!node.parentId || !removed.has(node.parentId)) return node;
          const rest = { ...node };
          delete rest.parentId;
          return {
            ...rest,
            position: absolutePosition(node, nodes),
            data: node.data.kind === "block" ? { ...node.data, containerId: null } : node.data,
          };
        });
      return {
        ...commit(
          state,
          mapActiveSectionFull(state.diagram, (section) => withoutDanglingEdges({ ...section, nodes: kept })),
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
      getActiveSection(state.diagram).nodes.find((node) => node.id === id)?.data.label === label
        ? state
        : commit(
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

  updateNodeIcon: (id, icon) =>
    set((state) => {
      const node = getActiveSection(state.diagram).nodes.find((candidate) => candidate.id === id);
      if (node?.data.kind !== "block" || node.data.icon === icon) return state;
      return commit(
        state,
        mapActiveSection(state.diagram, (nodes) =>
          nodes.map((candidate) =>
            candidate.id === id && candidate.data.kind === "block"
              ? { ...candidate, data: { ...candidate.data, icon } }
              : candidate,
          ),
        ),
      );
    }),

  // Switching tabs is navigation, not an edit, so it isn't recorded. It also leaves any internal design.
  setActiveSection: (id) =>
    set((state) =>
      state.diagram.sections.some((section) => section.id === id)
        ? {
            diagram: { ...state.diagram, activeSectionId: id, activeDetailId: undefined },
            selectedNodeIds: [],
            selectedEdgeId: null,
          }
        : state,
    ),

  openDetail: (componentId) =>
    set((state) => {
      const view = getActiveSection(state.diagram);
      const component = view.nodes.find((node) => node.id === componentId);
      if (view.parent || component?.type !== "block") return state;
      return { diagram: { ...state.diagram, activeDetailId: componentId }, selectedNodeIds: [], selectedEdgeId: null };
    }),

  closeDetail: () =>
    set((state) => {
      const { parent } = getActiveSection(state.diagram);
      return {
        diagram: { ...state.diagram, activeDetailId: undefined },
        selectedNodeIds: parent ? [parent.component.id] : [],
        selectedEdgeId: null,
      };
    }),

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
            activeDetailId: undefined,
          }),
        ),
        selectedNodeIds: [],
        selectedEdgeId: null,
      };
    }),

  renameSection: (id, name) =>
    set((state) =>
      state.diagram.sections.find((section) => section.id === id)?.name === name
        ? state
        : commit(
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
        ...commit(
          state,
          touch({
            ...state.diagram,
            sections: remaining,
            activeSectionId: nextActive,
            activeDetailId: activeSectionId === id ? undefined : state.diagram.activeDetailId,
          }),
        ),
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
        ...commit(state, touch({ ...state.diagram, sections, activeSectionId: copy.id, activeDetailId: undefined })),
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
      const color = nextLegendColor(legend.map((entry) => entry.color));
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
          sections: mapEveryNode(state.diagram, (node) =>
            node.data.colorKey === key ? { ...node, data: { ...node.data, colorKey: undefined } } : node,
          ),
        }),
      ),
    ),
}));

/** What the canvas shows: a tab, or (with `parent` set) the internal design of one of its components. */
export interface ActiveView extends DiagramSection {
  parent?: { section: DiagramSection; component: DiagramNode };
}

const NO_NODES: DiagramNode[] = [];
/** One view object per component and tab version, so store selectors get a stable value back. */
const detailViews = new WeakMap<DiagramNode, ActiveView>();

/**
 * The view on screen. Edits made through the store apply to it, so every editing action works the same
 * on a tab (L0/L1) and inside a component's internal design (L2).
 */
export function getActiveSection(diagram: Diagram): ActiveView {
  const section = diagram.sections.find((candidate) => candidate.id === diagram.activeSectionId) ?? diagram.sections[0];
  const component = diagram.activeDetailId
    ? section.nodes.find((node) => node.id === diagram.activeDetailId && node.type === "block")
    : undefined;
  if (!component || component.data.kind !== "block") return section;
  const cached = detailViews.get(component);
  if (cached?.parent?.section === section) return cached;
  const view: ActiveView = {
    id: `${section.id}/${component.id}`,
    name: component.data.label,
    nodes: component.data.detail?.nodes ?? NO_NODES,
    edges: component.data.detail?.edges,
    parent: { section, component },
  };
  detailViews.set(component, view);
  return view;
}

/** Every node in the diagram, including those inside internal designs. */
export function everyNode(diagram: Diagram): DiagramNode[] {
  return diagram.sections.flatMap((section) =>
    section.nodes.flatMap((node) => [node, ...(node.data.kind === "block" ? (node.data.detail?.nodes ?? []) : [])]),
  );
}

/** Components in a section that have an internal design. */
export function componentsWithDetail(section: DiagramSection): DiagramNode[] {
  return section.nodes.filter((node) => node.data.kind === "block" && !!node.data.detail?.nodes.length);
}
