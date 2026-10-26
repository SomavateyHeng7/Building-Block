"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  ReactFlow,
  SelectionMode,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type OnBeforeDelete,
  type NodeChange,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { useMounted } from "@/components/theme-toggle";
import { getActiveSection, useDiagramStore, type NodesChangeOptions } from "@/lib/diagram/store";
import { fromFlowNodes, historyKey, toFlowEdges, toFlowNodes, type FlowNode } from "@/lib/diagram/flowAdapter";
import { containerInsets, dropIntoContainers, growContainerToFit } from "@/lib/diagram/layout";
import { changeMarksForView } from "@/lib/diagram/compare";
import ContainerNode from "./nodes/ContainerNode";
import BlockNode from "./nodes/BlockNode";
import ConnectionEdge from "./edges/ConnectionEdge";
import { useCanvasFocus } from "./canvasFocus";
import { requestDelete } from "./deletePrompt";
import { useCompareView } from "./compareView";
import { useRenderEverything } from "./exportRendering";
import { Icon } from "./Icon";
import { PALETTE_DATA_FORMAT, type PaletteDragPayload } from "./Sidebar";
import { useReadOnly } from "./viewMode";
import type { BlockColorKey, ConnectionSide, ContainerNodeData } from "@/lib/diagram/types";

function subscribeWide(callback: () => void) {
  const query = window.matchMedia("(min-width: 768px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** The minimap covers too much of a phone-sized canvas. */
function useIsWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 768px)").matches, () => true);
}

const nodeTypes = { container: ContainerNode, block: BlockNode };
const edgeTypes = { connection: ConnectionEdge };

/** The top-most container under the point (later containers render above earlier ones). */
function findContainerAtPoint(containers: FlowNode[], point: { x: number; y: number }) {
  return containers.findLast((container) => {
    const width = container.width ?? 0;
    const height = container.height ?? 0;
    return (
      point.x >= container.position.x &&
      point.x <= container.position.x + width &&
      point.y >= container.position.y &&
      point.y <= container.position.y + height
    );
  });
}

/**
 * Decides how a batch of React Flow changes is recorded in undo history.
 * Returns null when the batch is only selection or size measurement — not an edit.
 */
function historyOptionsFor(changes: NodeChange[]): NodesChangeOptions | null {
  const resized = changes.filter((change) => change.type === "dimensions" && change.resizing !== undefined);
  if (resized.length) {
    return { coalesceKey: historyKey("resize", resized.map((change) => ("id" in change ? change.id : ""))) };
  }
  const moved = changes.filter((change) => change.type === "position");
  if (moved.length) {
    return { coalesceKey: historyKey("move", moved.map((change) => ("id" in change ? change.id : ""))) };
  }
  if (changes.some((change) => change.type === "remove" || change.type === "add" || change.type === "replace")) {
    return {};
  }
  return null;
}

export default function Canvas() {
  const diagram = useDiagramStore((state) => state.diagram);
  const selectedNodeIds = useDiagramStore((state) => state.selectedNodeIds);
  const setActiveSectionNodes = useDiagramStore((state) => state.setActiveSectionNodes);
  const setSelection = useDiagramStore((state) => state.setSelection);
  const selectedEdgeId = useDiagramStore((state) => state.selectedEdgeId);
  const setSelectedEdge = useDiagramStore((state) => state.setSelectedEdge);
  const addConnection = useDiagramStore((state) => state.addConnection);
  const deleteConnections = useDiagramStore((state) => state.deleteConnections);
  const reconnectConnection = useDiagramStore((state) => state.reconnectConnection);
  const addContainer = useDiagramStore((state) => state.addContainer);
  const addBlock = useDiagramStore((state) => state.addBlock);
  const { screenToFlowPosition, fitView, getNode } = useReactFlow();
  const focus = useCanvasFocus((state) => state.target);
  const comparePair = useCompareView((state) => state.pair);
  const renderEverything = useRenderEverything((state) => state.on);
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const wide = useIsWide();
  const readOnly = useReadOnly();
  const colorMode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const section = getActiveSection(diagram);

  /** The middle of what's on screen, in diagram coordinates. */
  function paneCenter() {
    const pane = document.querySelector(".react-flow")?.getBoundingClientRect();
    return screenToFlowPosition({
      x: pane ? pane.left + pane.width / 2 : window.innerWidth / 2,
      y: pane ? pane.top + pane.height / 2 : window.innerHeight / 2,
    });
  }

  // While two tabs are compared on the canvas, what changed is outlined in its change's colour.
  const marks = useMemo(() => changeMarksForView(diagram, comparePair, section), [diagram, comparePair, section]);

  const flowNodes = useMemo(
    () => toFlowNodes(section.nodes, new Set(selectedNodeIds), marks),
    [section.nodes, selectedNodeIds, marks],
  );

  const flowEdges = useMemo(
    () => toFlowEdges(section.edges ?? [], selectedEdgeId, colorMode === "dark", marks),
    [section.edges, selectedEdgeId, colorMode, marks],
  );

  // Zoom to something found by search or picked in Compare. Going to another view remounts the canvas, so
  // this waits until those nodes are measured, and a frame more for the canvas's own fit-to-everything.
  useEffect(() => {
    if (!focus) return;
    const edge = focus.kind === "edge" ? section.edges?.find((candidate) => candidate.id === focus.id) : undefined;
    const ids = edge ? [edge.source, edge.target] : [focus.id];
    if (!ids.every((id) => section.nodes.some((node) => node.id === id))) return;
    let cancelled = false;
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    void (async () => {
      for (let attempt = 0; attempt < 40 && !cancelled; attempt++) {
        await frame();
        if (ids.every((id) => getNode(id)?.measured?.width)) break;
      }
      await frame();
      if (cancelled) return;
      useCanvasFocus.getState().clear();
      void fitView({ nodes: ids.map((id) => ({ id })), padding: 0.6, maxZoom: 1.25, duration: 300 });
    })();
    return () => {
      cancelled = true;
    };
  }, [focus, section, fitView, getNode]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      addConnection({
        source: connection.source,
        target: connection.target,
        sourceSide: (connection.sourceHandle as ConnectionSide | null) ?? undefined,
        targetSide: (connection.targetHandle as ConnectionSide | null) ?? undefined,
      });
    },
    [addConnection],
  );

  // Connections live in the store; React Flow reports clicks and the Delete key here.
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removed = changes.flatMap((change) => (change.type === "remove" ? [change.id] : []));
      if (removed.length) deleteConnections(removed);
      const picked = changes.find((change) => change.type === "select" && change.selected);
      if (picked && picked.type === "select") setSelectedEdge(picked.id);
    },
    [deleteConnections, setSelectedEdge],
  );

  // Delete goes through the store, which prunes connections and records a single undo step. A container
  // holding components asks first whether to keep them (React Flow would delete them too).
  const handleBeforeDelete: OnBeforeDelete = useCallback(
    async ({ nodes, edges }) => {
      // React Flow adds a deleted container's children to the list; only delete those that were selected themselves.
      const listed = new Set(nodes.map((node) => node.id));
      const ids = nodes
        .filter((node) => !node.parentId || !listed.has(node.parentId) || selectedNodeIds.includes(node.id))
        .map((node) => node.id);
      // Returning false cancels React Flow's own delete, edges included, so a selected connection is deleted here.
      // Only selected ones: the list also has the kept components' connections.
      const edgeIds = edges.filter((edge) => edge.selected).map((edge) => edge.id);
      requestDelete(ids, edgeIds);
      return false;
    },
    [selectedNodeIds],
  );

  // Dragging an end of a selected connection onto another box or side moves that end.
  const handleReconnect = useCallback(
    (edge: Edge, connection: Connection) => {
      reconnectConnection(edge.id, {
        source: connection.source,
        target: connection.target,
        sourceSide: (connection.sourceHandle as ConnectionSide | null) ?? undefined,
        targetSide: (connection.targetHandle as ConnectionSide | null) ?? undefined,
      });
    },
    [reconnectConnection],
  );

  const handlePaneClick = useCallback(() => {
    setSelection([]);
    setSelectedEdge(null);
  }, [setSelection, setSelectedEdge]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Selection lives in the store; React Flow reports clicks, shift-clicks and box selection here.
      const selectChanges = changes.filter((change) => change.type === "select");
      const removed = new Set(
        changes.flatMap((change) => (change.type === "remove" ? [change.id] : [])),
      );
      if (selectChanges.length || removed.size) {
        const next = new Set(selectedNodeIds);
        for (const change of selectChanges) {
          if (change.selected) next.add(change.id);
          else next.delete(change.id);
        }
        removed.forEach((id) => next.delete(id));
        setSelection([...next]);
      }

      const options = historyOptionsFor(changes);
      if (!options) return;
      const updated = fromFlowNodes(applyNodeChanges(changes, flowNodes) as FlowNode[], section.nodes);
      // A component resized past its container's edge makes the container grow, as when dragging.
      const parents = new Set(
        changes.flatMap((change) =>
          change.type === "dimensions" ? (updated.find((node) => node.id === change.id)?.parentId ?? []) : [],
        ),
      );
      setActiveSectionNodes([...parents].reduce((nodes, id) => growContainerToFit(nodes, id), updated), options);
    },
    [flowNodes, section.nodes, selectedNodeIds, setActiveSectionNodes, setSelection],
  );

  // Dropping decides which container each dragged component is in: into one, out of one, or across.
  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, dragged) => {
      const current = fromFlowNodes(flowNodes, section.nodes);
      const nodes = dropIntoContainers(
        current,
        dragged.map((node) => ({ id: node.id, position: node.position })),
      );
      if (nodes.every((node, index) => node === current[index])) return;
      // Same key as the drag itself, so the move and the re-parent undo together.
      setActiveSectionNodes(nodes, { coalesceKey: historyKey("move", dragged.map((node) => node.id)) });
    },
    [flowNodes, section.nodes, setActiveSectionNodes],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData(PALETTE_DATA_FORMAT);
      if (!raw || readOnly) return;

      const payload = JSON.parse(raw) as PaletteDragPayload;
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      if (payload.kind === "container") {
        addContainer({ x: point.x - 160, y: point.y - 32 });
        return;
      }

      const containers = flowNodes.filter((node) => node.type === "container");
      const target = findContainerAtPoint(containers, point);
      const insets = target ? containerInsets(target.data as ContainerNodeData) : null;
      const position =
        target && insets
          ? {
              x: Math.max(insets.left, point.x - target.position.x - 70),
              y: Math.max(insets.top, point.y - target.position.y - 28),
            }
          : { x: point.x - 70, y: point.y - 28 };

      addBlock(position, target?.id ?? null, payload.colorKey as BlockColorKey);
    },
    [addBlock, addContainer, flowNodes, readOnly, screenToFlowPosition],
  );

  return (
    <ReactFlow
      key={section.id}
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      connectionMode={ConnectionMode.Loose}
      isValidConnection={(connection) => connection.source !== connection.target}
      onConnect={handleConnect}
      onReconnect={handleReconnect}
      onEdgesChange={handleEdgesChange}
      onBeforeDelete={handleBeforeDelete}
      onPaneClick={handlePaneClick}
      colorMode={colorMode}
      onNodesChange={handleNodesChange}
      onNodeDragStop={handleNodeDragStop}
      deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      edgesReconnectable={!readOnly}
      selectionMode={SelectionMode.Partial}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      snapToGrid
      snapGrid={[8, 8]}
      minZoom={0.2}
      maxZoom={2}
      onlyRenderVisibleElements={!renderEverything}
      fitView
    >
      <Background gap={16} />
      <Controls />
      {wide && <MiniMap pannable zoomable />}
      {section.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white/90 p-6 text-center text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-400">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <Icon name="layers" className="h-5 w-5" />
            </span>
            <div>
              {section.parent ? (
                <>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">What is {section.name} made of?</p>
                  <p className="mt-1">
                    Draw its internal design: the modules, services and stores inside it, and how they connect.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">This tab is empty</p>
                  <p className="mt-1">Start with a container to group your components, or drag items in from the panel.</p>
                </>
              )}
            </div>
            {readOnly ? (
              <p className="text-xs text-zinc-500">Switch to Edit to add something.</p>
            ) : (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                onClick={() => {
                  const center = paneCenter();
                  addContainer({ x: center.x - 160, y: center.y - 32 });
                }}
              >
                <Icon name="plus" />
                Container
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                onClick={() => {
                  const center = paneCenter();
                  addBlock({ x: center.x - 70, y: center.y - 28 });
                }}
              >
                <Icon name="plus" />
                Component
              </button>
            </div>
            )}
            <p className="hidden text-xs text-zinc-400 pointer-fine:block">
              Or press <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-700">C</kbd> /{" "}
              <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-700">B</kbd>, and{" "}
              <kbd className="rounded border border-zinc-300 px-1 font-mono dark:border-zinc-700">?</kbd> for all shortcuts
            </p>
          </div>
        </div>
      )}
    </ReactFlow>
  );
}
