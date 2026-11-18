import { create } from "zustand";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { toast } from "@/lib/editor/toast";
import { hasAncestorIn } from "@/lib/diagram/layout/layout";

/** A delete waiting for an answer about the components inside the containers being deleted. */
export interface PendingDelete {
  ids: string[];
  edgeIds: string[];
  /** Names of the containers being deleted that hold components. */
  containers: string[];
  /** How many components those containers hold. */
  contents: number;
}

/** Screen state, not part of the diagram (see DeleteContainerDialog). */
export const useDeletePrompt = create<{ pending: PendingDelete | null }>()(() => ({ pending: null }));

/** Nodes and connections together, as one undo step. */
function deleteBoth(ids: string[], edgeIds: string[], withContents?: boolean) {
  const store = useDiagramStore.getState();
  if (ids.length) store.deleteNodes(ids, { withContents, edgeIds });
  else if (edgeIds.length) store.deleteConnections(edgeIds);
}

/**
 * Deletes nodes and connections. When a container that holds components is among them, it asks first
 * whether to keep those components or delete them too: a box selection or Select all picks up a
 * container's components along with it, and losing them by surprise was easy.
 */
export function requestDelete(ids: string[], edgeIds: string[] = []) {
  const nodes = getActiveSection(useDiagramStore.getState().diagram).nodes;
  const holding = nodes.filter(
    (node) => node.type === "container" && ids.includes(node.id) && nodes.some((child) => child.parentId === node.id),
  );
  if (!holding.length) {
    deleteBoth(ids, edgeIds);
    return;
  }
  // Everything inside, however deep: a nested container's contents go too when "delete all" is picked.
  const holdingIds = new Set(holding.map((container) => container.id));
  const contents = nodes.filter((node) => hasAncestorIn(node, nodes, holdingIds)).length;
  useDeletePrompt.setState({
    pending: { ids, edgeIds, containers: holding.map((container) => container.data.label), contents },
  });
}

/** Answers the pending delete: "keep" leaves the containers' components on the canvas, "all" deletes them too. */
export function resolveDelete(choice: "keep" | "all" | "cancel") {
  const { pending } = useDeletePrompt.getState();
  useDeletePrompt.setState({ pending: null });
  if (!pending || choice === "cancel") return;
  if (choice === "all") {
    deleteBoth(pending.ids, pending.edgeIds, true);
    return;
  }
  const nodes = getActiveSection(useDiagramStore.getState().diagram).nodes;
  // A box selected along with a container it's in is kept with the others.
  const kept = new Set(nodes.filter((node) => hasAncestorIn(node, nodes, pending.ids)).map((node) => node.id));
  deleteBoth(pending.ids.filter((id) => !kept.has(id)), pending.edgeIds);
}

/**
 * Ungroups (see `ungroupNodes`), saying so when connections to a removed container went with it: those
 * joined the container itself, and there's no telling which of its components they meant.
 */
export function ungroup(ids: string[]) {
  const store = useDiagramStore.getState();
  const before = getActiveSection(store.diagram).edges?.length ?? 0;
  store.ungroupNodes(ids);
  const dropped = before - (getActiveSection(useDiagramStore.getState().diagram).edges?.length ?? 0);
  if (dropped > 0) {
    toast.info(`Removed ${dropped} connection${dropped === 1 ? "" : "s"} to the container`, {
      description: "They joined the container itself, not a component in it. Press Ctrl/⌘+Z to bring them back.",
    });
  }
}
