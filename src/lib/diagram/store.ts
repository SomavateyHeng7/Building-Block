import { create } from "zustand";
import { createBlankDiagram, createBlankSection, createId } from "./factory";
import type { BlockColorKey, Diagram, DiagramNode, LegendEntry, Position } from "./types";

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

interface DiagramState {
  diagram: Diagram;
  selectedNodeId: string | null;
  loadDiagram: (diagram: Diagram) => void;
  renameDiagram: (name: string) => void;
  selectNode: (id: string | null) => void;
  setActiveSectionNodes: (nodes: DiagramNode[]) => void;
  addContainer: (position: Position) => void;
  addBlock: (position: Position, parentId?: string | null, colorKey?: BlockColorKey) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeColor: (id: string, colorKey: BlockColorKey) => void;
  deleteNode: (id: string) => void;
  updateLegendEntry: (key: BlockColorKey, patch: Partial<LegendEntry>) => void;
  setActiveSection: (id: string) => void;
  addSection: (name?: string) => void;
  renameSection: (id: string, name: string) => void;
  deleteSection: (id: string) => void;
  duplicateSection: (id: string) => void;
}

export const useDiagramStore = create<DiagramState>((set) => ({
  diagram: createBlankDiagram(),
  selectedNodeId: null,

  loadDiagram: (diagram) => set({ diagram, selectedNodeId: null }),

  renameDiagram: (name) => set((state) => ({ diagram: touch({ ...state.diagram, name }) })),

  selectNode: (id) => set({ selectedNodeId: id }),

  setActiveSectionNodes: (nodes) =>
    set((state) => ({ diagram: mapActiveSection(state.diagram, () => nodes) })),

  addContainer: (position) =>
    set((state) => ({
      diagram: mapActiveSection(state.diagram, (nodes) => [
        ...nodes,
        {
          id: createId("container"),
          type: "container",
          position,
          size: { width: 320, height: 220 },
          data: { kind: "container", label: "New Container" },
        },
      ]),
    })),

  addBlock: (position, parentId = null, colorKey) =>
    set((state) => ({
      diagram: mapActiveSection(state.diagram, (nodes) => [
        ...nodes,
        {
          id: createId("block"),
          type: "block",
          position,
          size: { width: 140, height: 56 },
          parentId: parentId ?? undefined,
          data: {
            kind: "block",
            label: "New Block",
            colorKey: colorKey ?? state.diagram.legend[0]?.key ?? "product",
            containerId: parentId ?? null,
          },
        },
      ]),
    })),

  updateNodeLabel: (id, label) =>
    set((state) => ({
      diagram: mapActiveSection(state.diagram, (nodes) =>
        nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, label } } : node)),
      ),
    })),

  updateNodeColor: (id, colorKey) =>
    set((state) => ({
      diagram: mapActiveSection(state.diagram, (nodes) =>
        nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, colorKey } } : node)),
      ),
    })),

  deleteNode: (id) =>
    set((state) => ({
      diagram: mapActiveSection(state.diagram, (nodes) =>
        nodes.filter((node) => node.id !== id && node.parentId !== id),
      ),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  setActiveSection: (id) =>
    set((state) =>
      state.diagram.sections.some((section) => section.id === id)
        ? { diagram: { ...state.diagram, activeSectionId: id }, selectedNodeId: null }
        : state,
    ),

  addSection: (name) =>
    set((state) => {
      const section = createBlankSection(name ?? `Section ${state.diagram.sections.length + 1}`);
      return {
        diagram: touch({
          ...state.diagram,
          sections: [...state.diagram.sections, section],
          activeSectionId: section.id,
        }),
        selectedNodeId: null,
      };
    }),

  renameSection: (id, name) =>
    set((state) => ({
      diagram: touch({
        ...state.diagram,
        sections: state.diagram.sections.map((section) =>
          section.id === id ? { ...section, name } : section,
        ),
      }),
    })),

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
        diagram: touch({ ...state.diagram, sections: remaining, activeSectionId: nextActive }),
        selectedNodeId: activeSectionId === id ? null : state.selectedNodeId,
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
        diagram: touch({ ...state.diagram, sections, activeSectionId: copy.id }),
        selectedNodeId: null,
      };
    }),

  updateLegendEntry: (key, patch) =>
    set((state) => ({
      diagram: touch({
        ...state.diagram,
        legend: state.diagram.legend.map((entry) =>
          entry.key === key ? { ...entry, ...patch } : entry,
        ),
      }),
    })),
}));

export function getActiveSection(diagram: Diagram) {
  return diagram.sections.find((section) => section.id === diagram.activeSectionId) ?? diagram.sections[0];
}
