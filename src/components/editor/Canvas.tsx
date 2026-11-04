"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
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
  type NodeDimensionChange,
  type NodePositionChange,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { useMounted } from "@/components/theme-toggle";
import { getActiveSection, useDiagramStore, type NodesChangeOptions } from "@/lib/diagram/store";
import { fromFlowNodes, historyKey, toFlowEdges, toFlowNodes, type FlowNode } from "@/lib/diagram/flowAdapter";
import { MIN_NODE_SIZE, absolutePosition, containerInsets, dropIntoContainers, growContainerToFit, nudgeNodes } from "@/lib/diagram/layout";
import { alignmentLines, boxOf, nearestGaps, snapResize, snapToBoxes, unionBox, type Box } from "@/lib/diagram/guides";
import { changeMarksForView } from "@/lib/diagram/compare";
import ContainerNode from "./nodes/ContainerNode";
import BlockNode from "./nodes/BlockNode";
import TextNode from "./nodes/TextNode";
import { shapeInfo } from "@/lib/diagram/shapes";
import PixelGuides, { useGuides } from "./PixelGuides";
import ConnectionEdge from "./edges/ConnectionEdge";
import { useCanvasFocus } from "./canvasFocus";
import { requestDelete } from "./deletePrompt";
import { useCompareView } from "./compareView";
import { useRenderEverything } from "./exportRendering";
import { Icon } from "./Icon";
import { PALETTE_DATA_FORMAT, type PaletteDragPayload } from "./Sidebar";
import { useReadOnly } from "./viewMode";
import type { BlockColorKey, ConnectionSide, ContainerNodeData, DiagramNode } from "@/lib/diagram/types";

function subscribeWide(callback: () => void) {
  const query = window.matchMedia("(min-width: 768px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** The minimap covers too much of a phone-sized canvas. */
function useIsWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 768px)").matches, () => true);
}

const nodeTypes = { container: ContainerNode, block: BlockNode, text: TextNode };

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** How close (in screen pixels) a dragged box's edge or middle must come to another's to snap to it. */
const SNAP_DISTANCE = 6;

/**
 * Lines up a drag with the other boxes, to the pixel: rounds the moved positions to whole pixels, snaps the
 * moved boxes (together) to the nearest edge or middle of another box unless Alt is held, and reports the
 * guides, gaps and position to show. Changes positions in place; children of a moved container are left alone.
 */
function snapDrag(changes: NodePositionChange[], nodes: DiagramNode[], zoom: number, free: boolean) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const moving = new Set(changes.map((change) => change.id));
  const parentOffset = (node: DiagramNode) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    return parent ? parent.position : { x: 0, y: 0 };
  };
  const leading = changes.filter((change) => {
    const node = byId.get(change.id);
    return node && !(node.parentId && moving.has(node.parentId));
  });
  for (const change of leading) {
    change.position = { x: Math.round(change.position!.x), y: Math.round(change.position!.y) };
  }
  const boxes = leading.map((change) => {
    const node = byId.get(change.id)!;
    const offset = parentOffset(node);
    return boxOf({ x: change.position!.x + offset.x, y: change.position!.y + offset.y }, node.size);
  });
  const moved = unionBox(boxes);
  if (!moved) return null;
  const others = nodes
    .filter((node) => !moving.has(node.id) && !(node.parentId && moving.has(node.parentId)))
    .map((node) => boxOf(absolutePosition(node, nodes), node.size));
  const snap = free ? { dx: 0, dy: 0, lines: alignmentLines(moved, others) } : snapToBoxes(moved, others, SNAP_DISTANCE / zoom);
  const dx = Math.round(snap.dx);
  const dy = Math.round(snap.dy);
  if (dx || dy) {
    for (const change of leading) change.position = { x: change.position!.x + dx, y: change.position!.y + dy };
  }
  const box = { ...moved, x: moved.x + dx, y: moved.y + dy };
  return {
    lines: snap.lines,
    gaps: nearestGaps(box, others),
    readout: { box, text: `x ${box.x} · y ${box.y}` },
  };
}

interface ResizeStart {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/** The ids of a node, the containers it's in and everything inside it: a resize doesn't snap to those. */
function relatives(node: DiagramNode, nodes: DiagramNode[]): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const parent of containersOf(node, nodes)) ids.add(parent);
  for (const candidate of nodes) if (containersOf(candidate, nodes).includes(node.id)) ids.add(candidate.id);
  return ids;
}

/** The containers a node is in, innermost first. */
function containersOf(node: DiagramNode, nodes: DiagramNode[]): string[] {
  const found: string[] = [];
  for (let parent = node.parentId; parent && !found.includes(parent); parent = nodes.find((candidate) => candidate.id === parent)?.parentId) {
    found.push(parent);
  }
  return found;
}

/**
 * Lines up a resize with the other boxes, as `snapDrag` does for moves: the edges the handle moves snap to other
 * boxes' edges and middles, or to the same width or height as another box (unless Alt is held). Changes the
 * resize's size and position in place (and a container's children, so they stay put), and reports the guides,
 * size markers, gaps and W × H to show.
 */
function snapResizeChanges(
  changes: NodeChange[],
  resize: NodeDimensionChange & { dimensions: { width: number; height: number } },
  node: DiagramNode,
  start: ResizeStart,
  nodes: DiagramNode[],
  zoom: number,
  free: boolean,
) {
  const parent = node.parentId ? nodes.find((candidate) => candidate.id === node.parentId) : undefined;
  const offset = parent ? absolutePosition(parent, nodes) : { x: 0, y: 0 };
  const moved = changes.find((change): change is NodePositionChange => change.type === "position" && change.id === node.id && !!change.position);
  const position = moved?.position ?? node.position;
  const { width, height } = resize.dimensions;
  const edges = {
    left: position.x !== start.position.x,
    right: position.x === start.position.x && width !== start.size.width,
    top: position.y !== start.position.y,
    bottom: position.y === start.position.y && height !== start.size.height,
  };
  const raw: Box = { x: position.x + offset.x, y: position.y + offset.y, width, height };
  const skip = relatives(node, nodes);
  const others = nodes.filter((other) => !skip.has(other.id)).map((other) => boxOf(absolutePosition(other, nodes), other.size));
  const snap = snapResize(raw, edges, others, free ? 0 : SNAP_DISTANCE / zoom, MIN_NODE_SIZE[node.type]);

  // A container can't be snapped smaller than what's inside it: keep the unsnapped size on that axis instead.
  // Snapping to a middle can land on half a pixel.
  let box = { x: Math.round(snap.box.x), y: Math.round(snap.box.y), width: Math.round(snap.box.width), height: Math.round(snap.box.height) };
  let kept = true;
  if (node.type === "container") {
    const insets = containerInsets(node.data as ContainerNodeData);
    const content = unionBox(nodes.filter((child) => child.parentId === node.id).map((child) => boxOf(absolutePosition(child, nodes), child.size)));
    if (content) {
      if (box.x > content.x - insets.left || box.x + box.width < content.x + content.width + insets.right) {
        box = { ...box, x: raw.x, width: raw.width };
        kept = false;
      }
      if (box.y > content.y - insets.top || box.y + box.height < content.y + content.height + insets.bottom) {
        box = { ...box, y: raw.y, height: raw.height };
        kept = false;
      }
    }
  }

  resize.dimensions = { width: box.width, height: box.height };
  const dx = box.x - raw.x;
  const dy = box.y - raw.y;
  if (moved && (dx || dy)) {
    moved.position = { x: box.x - offset.x, y: box.y - offset.y };
    // React Flow moves a container's children back by the unsnapped change; the snap moved the edge a bit further.
    for (const change of changes) {
      if (change.type !== "position" || !change.position) continue;
      if (nodes.find((candidate) => candidate.id === change.id)?.parentId !== node.id) continue;
      change.position = { x: change.position.x - dx, y: change.position.y - dy };
    }
  }
  return {
    lines: kept ? snap.lines : [],
    gaps: [...(kept ? snap.sizes : []), ...nearestGaps(box, others)],
    readout: { box, text: `${box.width} × ${box.height}` },
  };
}

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
  const addText = useDiagramStore((state) => state.addText);
  const { screenToFlowPosition, fitView, getNode, getZoom } = useReactFlow();
  const showGuides = useGuides((state) => state.show);
  const clearGuides = useGuides((state) => state.clear);
  const hoverNode = useGuides((state) => state.hover);
  const setResizing = useGuides((state) => state.setResizing);
  const resizingBox = useGuides((state) => state.resizing);
  // Where the box being resized started, to tell which edges the handle moves.
  const resizeStart = useRef<ResizeStart | null>(null);
  // Alt while dragging moves freely, without snapping to other boxes.
  const altHeld = useRef(false);
  useEffect(() => {
    const update = (event: KeyboardEvent | PointerEvent) => {
      altHeld.current = event.altKey;
    };
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("pointermove", update);
    return () => {
      window.removeEventListener("keydown", update);
      window.removeEventListener("keyup", update);
      window.removeEventListener("pointermove", update);
    };
  }, []);
  useEffect(() => clearGuides, [clearGuides]);
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
    () =>
      toFlowEdges(
        section.edges ?? [],
        selectedEdgeId,
        colorMode === "dark",
        marks,
        new Map(section.nodes.map((node) => [node.id, node.data.label])),
      ),
    [section.edges, section.nodes, selectedEdgeId, colorMode, marks],
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

      // While dragging, positions go to whole pixels and line up with other boxes (Alt to move freely).
      const dragged = changes.filter(
        (change): change is NodePositionChange => change.type === "position" && !!change.dragging && !!change.position,
      );
      if (dragged.length) {
        const guides = snapDrag(dragged, section.nodes, getZoom(), altHeld.current);
        if (guides) showGuides(guides);
      }
      // While resizing, sizes go to whole pixels, snap to other boxes (Alt to resize freely) and are measured.
      const resizing = changes.filter(
        (change): change is NodeDimensionChange & { dimensions: { width: number; height: number } } =>
          change.type === "dimensions" && !!change.resizing && !!change.dimensions,
      );
      for (const change of resizing) {
        change.dimensions = { width: Math.round(change.dimensions.width), height: Math.round(change.dimensions.height) };
      }
      for (const change of changes) {
        if (change.type === "position" && change.position && !change.dragging) {
          change.position = { x: Math.round(change.position.x), y: Math.round(change.position.y) };
        }
      }
      if (resizing.length === 1) {
        const node = section.nodes.find((candidate) => candidate.id === resizing[0].id);
        if (node) {
          if (resizeStart.current?.id !== node.id) resizeStart.current = { id: node.id, position: node.position, size: node.size };
          setResizing(true);
          const guides = snapResizeChanges(changes, resizing[0], node, resizeStart.current, section.nodes, getZoom(), altHeld.current);
          showGuides(guides);
        }
      } else if (changes.some((change) => change.type === "dimensions" && change.resizing === false)) {
        resizeStart.current = null;
        clearGuides();
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
    [flowNodes, section.nodes, selectedNodeIds, setActiveSectionNodes, setSelection, getZoom, showGuides, clearGuides, setResizing],
  );

  // Dropping decides which container each dragged component is in: into one, out of one, or across.
  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, dragged) => {
      clearGuides();
      const current = fromFlowNodes(flowNodes, section.nodes);
      const nodes = dropIntoContainers(
        current,
        dragged.map((node) => ({ id: node.id, position: node.position })),
      );
      if (nodes.every((node, index) => node === current[index])) return;
      // Same key as the drag itself, so the move and the re-parent undo together.
      setActiveSectionNodes(nodes, { coalesceKey: historyKey("move", dragged.map((node) => node.id)) });
    },
    [flowNodes, section.nodes, setActiveSectionNodes, clearGuides],
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
        addContainer({ x: Math.round(point.x - 160), y: Math.round(point.y - 32) });
        return;
      }
      // Components and text boxes dropped on a container go inside it.
      const size =
        payload.kind === "shape" ? shapeInfo(payload.shape).size : payload.kind === "text" ? { width: 160, height: 32 } : { width: 140, height: 56 };

      const containers = flowNodes.filter((node) => node.type === "container");
      const target = findContainerAtPoint(containers, point);
      const insets = target ? containerInsets(target.data as ContainerNodeData) : null;
      const position =
        target && insets
          ? {
              x: Math.round(Math.max(insets.left, point.x - target.position.x - size.width / 2)),
              y: Math.round(Math.max(insets.top, point.y - target.position.y - size.height / 2)),
            }
          : { x: Math.round(point.x - size.width / 2), y: Math.round(point.y - size.height / 2) };

      if (payload.kind === "text") addText(position, undefined, target?.id ?? null);
      else if (payload.kind === "shape") addBlock(position, target?.id ?? null, undefined, payload.shape);
      else addBlock(position, target?.id ?? null, payload.colorKey as BlockColorKey);
    },
    [addBlock, addContainer, addText, flowNodes, readOnly, screenToFlowPosition],
  );

  return (
    <ReactFlow
      key={section.id}
      className={resizingBox ? "bb-resizing" : undefined}
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      connectionMode={ConnectionMode.Loose}
      isValidConnection={(connection) =>
        connection.source !== connection.target &&
        getNode(connection.source)?.type !== "text" &&
        getNode(connection.target)?.type !== "text"
      }
      // A focused box would move 5 px per arrow press (React Flow's own keys); the editor's nudge (1 px, Shift: 10) runs instead.
      onKeyDownCapture={(event) => {
        const direction = ARROWS[event.key];
        if (!direction || event.altKey || event.metaKey || event.ctrlKey) return;
        if (!(event.target as HTMLElement).closest?.(".react-flow__node")) return;
        // Stopping it here also keeps it from the editor's window shortcut, so the nudge is done here.
        event.stopPropagation();
        event.preventDefault();
        if (readOnly || !selectedNodeIds.length) return;
        const step = event.shiftKey ? 10 : 1;
        setActiveSectionNodes(nudgeNodes(section.nodes, selectedNodeIds, direction[0] * step, direction[1] * step), {
          coalesceKey: `nudge:${selectedNodeIds.join(",")}`,
        });
      }}
      onNodeMouseEnter={(_event, node) => hoverNode(node.id)}
      onNodeMouseLeave={() => hoverNode(null)}
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
      minZoom={0.2}
      maxZoom={2}
      onlyRenderVisibleElements={!renderEverything}
      fitView
    >
      <Background gap={16} />
      <PixelGuides />
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
