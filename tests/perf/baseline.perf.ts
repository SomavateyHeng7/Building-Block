import { writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { applyNodeChanges, type NodeChange } from "@xyflow/react";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { fromFlowNodes, historyKey, toFlowEdges, toFlowNodes, type FlowNode } from "@/lib/diagram/flowAdapter";
import { dropIntoContainers } from "@/lib/diagram/layout";
import { parseDiagram } from "@/lib/diagram/validate";
import { searchDiagram } from "@/lib/diagram/search";
import { compareSections } from "@/lib/diagram/compare";
import type { Diagram, DiagramNode } from "@/lib/diagram/types";
import { stressDiagram, stressStats } from "./stressDiagram";

/**
 * Baseline timings for the editor's logic on large diagrams (no browser rendering; see e2e/perf.spec.ts for
 * that). Run with `pnpm perf`. Prints a table, and writes JSON to $PERF_OUT when set.
 * A drag frame has about 16 ms at 60 fps, and rendering needs most of it, so logic should stay well under 8 ms.
 */

const SIZES = [100, 500, 1000, 2000];
const FRAME_BUDGET_MS = 8;

interface Row {
  size: number;
  operation: string;
  median: number;
  p95: number;
  note?: string;
}
const rows: Row[] = [];

const store = () => useDiagramStore.getState();

function measure(size: number, operation: string, fn: (iteration: number) => void, iterations = 30, note?: string) {
  for (let i = 0; i < 3; i++) fn(-1 - i);
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn(i);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const row = {
    size,
    operation,
    median: samples[Math.floor(samples.length / 2)],
    p95: samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)],
    note,
  };
  rows.push(row);
  return row;
}

/** What Canvas does for one frame of a drag: React Flow's change applied, back to the store, and re-rendered. */
function dragFrame(ids: string[], step: number) {
  const { diagram, selectedNodeIds } = store();
  const section = getActiveSection(diagram);
  const flowNodes = toFlowNodes(section.nodes, new Set(selectedNodeIds), null);
  const byId = new Map(section.nodes.map((node) => [node.id, node]));
  const changes: NodeChange[] = ids.map((id) => {
    const { x, y } = byId.get(id)!.position;
    return { id, type: "position", position: { x: x + step, y }, dragging: true };
  });
  const updated = fromFlowNodes(applyNodeChanges(changes, flowNodes) as FlowNode[], section.nodes);
  store().setActiveSectionNodes(updated, { coalesceKey: historyKey("move", ids) });
  // The next render converts the store's nodes and connections again.
  const next = getActiveSection(store().diagram);
  toFlowNodes(next.nodes, new Set(store().selectedNodeIds), null);
  toFlowEdges(next.edges ?? [], null, false, null);
}

/** Distinct node objects kept alive by the diagram plus its undo history: a stand-in for memory use. */
function retainedNodes(): number {
  const seen = new Set<DiagramNode>();
  for (const diagram of [store().diagram, ...store().past]) {
    for (const section of diagram.sections) for (const node of section.nodes) seen.add(node);
  }
  return seen.size;
}

function blocksIn(diagram: Diagram, count: number) {
  return getActiveSection(diagram)
    .nodes.filter((node) => node.type === "block")
    .slice(0, count)
    .map((node) => node.id);
}

describe.each(SIZES)("%i components per tab", (size) => {
  const diagram = stressDiagram({ componentsPerTab: size });
  const text = JSON.stringify(diagram, null, 2);
  const stats = stressStats(diagram);

  it("is a valid diagram file", () => {
    const { fixes } = parseDiagram(JSON.parse(text));
    expect(fixes).toEqual([]);
  });

  it("measures", () => {
    rows.push({
      size,
      operation: "diagram",
      median: 0,
      p95: 0,
      note: `${stats.tabs} tabs, ${stats.nodes} nodes, ${stats.edges} connections, ${stats.details} internal designs, ${(stats.bytes / 1024 / 1024).toFixed(1)} MB`,
    });

    measure(size, "open: parse + validate", () => void parseDiagram(JSON.parse(text)), 10);
    store().loadDiagram(parseDiagram(JSON.parse(text)).diagram);
    measure(size, "save: serialise", () => void JSON.stringify(store().diagram, null, 2), 10);

    const one = blocksIn(store().diagram, 1);
    store().setSelection(one);
    measure(size, "drag frame: 1 component", (i) => dragFrame(one, i % 2 ? 8 : -8), 60);

    const fifty = blocksIn(store().diagram, 50);
    store().setSelection(fifty);
    measure(size, "drag frame: 50 components", (i) => dragFrame(fifty, i % 2 ? 8 : -8), 60);

    measure(size, "drag end: re-parent 50", () => {
      const nodes = getActiveSection(store().diagram).nodes;
      dropIntoContainers(nodes, fifty.map((id) => ({ id, position: nodes.find((node) => node.id === id)!.position })));
    });

    measure(size, "typing: rename (1 keystroke)", (i) => store().updateNodeLabel(one[0], `Renamed ${i}`), 60);

    store().setSelection(fifty);
    store().copySelection();
    measure(size, "paste 50", () => {
      store().paste();
      store().undo();
    }, 10, "paste + undo");

    measure(size, "find: one keystroke", () => void searchDiagram(store().diagram, "ord"));

    const [from, to] = store().diagram.sections;
    measure(size, "compare two tabs", () => void compareSections(store().diagram, from, to), 10);

    // 50 separate drags (no coalescing): how much each undo step keeps alive.
    store().loadDiagram(parseDiagram(JSON.parse(text)).diagram);
    const tabNodes = getActiveSection(store().diagram).nodes.length;
    for (let i = 0; i < 50; i++) {
      store().setSelection(one);
      dragFrame(one, 8);
      store().setActiveSectionNodes(getActiveSection(store().diagram).nodes, { coalesceKey: `separate:${i}` });
    }
    const retained = retainedNodes();
    // Ideally each drag adds just the node it moved (plus its container if that grew).
    const ideal = store().diagram.sections.reduce((sum, section) => sum + section.nodes.length, 0) + 50;
    rows.push({
      size,
      operation: "undo history after 50 drags",
      median: 0,
      p95: 0,
      note: `${retained.toLocaleString("en")} node objects kept (ideal ≈ ${ideal.toLocaleString("en")}; this tab has ${tabNodes})`,
    });
  });
});

afterAll(() => {
  const fmt = (ms: number) => (ms ? ms.toFixed(2) : "");
  const lines = [
    "| Components/tab | Operation | Median ms | p95 ms | Note |",
    "| ---: | --- | ---: | ---: | --- |",
    ...rows.map((row) => {
      const over = row.operation.startsWith("drag frame") && row.median > FRAME_BUDGET_MS ? " ⚠ over frame budget" : "";
      return `| ${row.size} | ${row.operation} | ${fmt(row.median)} | ${fmt(row.p95)} | ${row.note ?? ""}${over} |`;
    }),
  ];
  console.log(`\n${lines.join("\n")}\n`);
  if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify(rows, null, 2));
});
