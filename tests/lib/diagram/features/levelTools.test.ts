import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { useFileStore } from "@/lib/diagram/persistence/file";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import {
  COMMON_PROTOCOLS,
  L1_CONTEXT_LABEL,
  connectionSuggestions,
  isAsyncProtocol,
  l1Neighbours,
  landscapeSummary,
  lastProtocol,
  protocolChips,
} from "@/lib/diagram/features/levelTools";
import { parseDiagram } from "@/lib/diagram/validate";
import type { DiagramNode } from "@/lib/diagram/types";

const store = () => useDiagramStore.getState();
const view = () => getActiveSection(store().diagram);

function addBlock(x = 0, y = 0) {
  store().addBlock({ x, y });
  return store().selectedNodeIds[0];
}

beforeEach(() => {
  vi.stubGlobal("window", {});
  useFileStore.setState({ opened: false, handle: null, fileName: null, saved: null, saving: false, error: false });
  store().loadDiagram(createBlankDiagram());
});

describe("landscape summary (L0)", () => {
  it("counts containers, components and connections, and groups them by category in legend order", () => {
    const legend = store().diagram.legend;
    const a = addBlock();
    const b = addBlock(200);
    store().addContainer({ x: 0, y: 200 });
    store().updateNodeColor(b, legend[1].key);
    store().addText({ x: 0, y: 400 }, "A note");
    store().addConnection({ source: a, target: b });

    const summary = landscapeSummary(view(), legend);
    expect(summary).toMatchObject({ containers: 1, components: 2, connections: 1 });
    expect(summary.categories.map((category) => category.key)).toEqual([legend[0].key, legend[1].key, undefined]);
    expect(summary.categories[0].ids).toEqual([a]);
    expect(summary.categories.at(-1)?.label).toBe("No category");
  });

  it("treats a category that's no longer in the legend as none", () => {
    const a = addBlock();
    const summary = landscapeSummary(view(), []);
    expect(summary.categories).toEqual([{ label: "No category", ids: [a] }]);
  });
});

describe("connection suggestions (L1)", () => {
  it("offers what the diagram already uses, most used first, then common protocols", () => {
    const a = addBlock();
    const b = addBlock(200);
    const c = addBlock(400);
    const ab = store().addConnection({ source: a, target: b })!;
    const bc = store().addConnection({ source: b, target: c })!;
    const ca = store().addConnection({ source: c, target: a })!;
    store().updateConnection(ab, { protocol: "Kafka", label: "Orders" });
    store().updateConnection(bc, { protocol: "kafka ", label: "Payments" });
    store().updateConnection(ca, { protocol: "Thrift", label: "Orders" });

    const { labels, protocols } = connectionSuggestions(store().diagram);
    expect(labels).toEqual(["Orders", "Payments"]);
    expect(protocols.slice(0, 2)).toEqual(["Kafka", "Thrift"]);
    expect(protocols.filter((value) => value.toLowerCase() === "kafka")).toHaveLength(1);
    expect(protocols).toHaveLength(COMMON_PROTOCOLS.length + 1);
  });

  it("includes connections inside internal designs", () => {
    const owner = addBlock();
    store().openDetail(owner);
    const x = addBlock();
    const y = addBlock(200);
    store().updateConnection(store().addConnection({ source: x, target: y })!, { protocol: "JDBC" });
    expect(connectionSuggestions(store().diagram).protocols[0]).toBe("JDBC");
  });

  it("recognises asynchronous protocols", () => {
    for (const value of ["Kafka", "AMQP", "SQS", "Domain events", "Pub/Sub", "SFTP"]) expect(isAsyncProtocol(value)).toBe(true);
    for (const value of ["REST", "gRPC", "JDBC", "", undefined]) expect(isAsyncProtocol(value)).toBe(false);
  });
});

describe("less typing on connections (L1)", () => {
  it("offers a short list of chips, most used first, without the protocol already set", () => {
    const a = addBlock();
    const b = addBlock(200);
    const ab = store().addConnection({ source: a, target: b })!;
    store().updateConnection(ab, { protocol: "Kafka" });
    const chips = protocolChips(store().diagram, "REST");
    expect(chips).toHaveLength(6);
    expect(chips[0]).toBe("Kafka");
    expect(chips).not.toContain("REST");
    expect(protocolChips(store().diagram, "kafka")).not.toContain("Kafka");
  });

  it("finds the newest connection's protocol", () => {
    expect(lastProtocol(undefined)).toBeUndefined();
    expect(
      lastProtocol([
        { id: "1", source: "a", target: "b", protocol: "REST" },
        { id: "2", source: "b", target: "c", protocol: "gRPC" },
        { id: "3", source: "c", target: "a", protocol: "  " },
      ]),
    ).toBe("gRPC");
  });

  it("starts a new connection with the protocol of the newest one on the canvas", () => {
    const a = addBlock();
    const b = addBlock(200);
    const c = addBlock(400);
    const first = store().addConnection({ source: a, target: b })!;
    expect(view().edges![0].protocol).toBeUndefined();
    store().updateConnection(first, { protocol: "REST" });
    const second = store().addConnection({ source: b, target: c })!;
    expect(view().edges!.find((edge) => edge.id === second)?.protocol).toBe("REST");
  });

  it("makes each finished caption edit its own undo step, while typing still undoes as one", () => {
    const a = addBlock();
    const b = addBlock(200);
    const id = store().addConnection({ source: a, target: b })!;
    const caption = () => view().edges![0].label;

    store().updateConnection(id, { label: "O" });
    store().updateConnection(id, { label: "Orders" });
    store().undo();
    expect(caption()).toBeUndefined();

    store().updateConnection(id, { label: "First", protocol: "REST" }, { ownStep: true });
    store().updateConnection(id, { label: "Second", protocol: "REST" }, { ownStep: true });
    store().undo();
    expect(caption()).toBe("First");
    store().undo();
    expect(caption()).toBeUndefined();
  });

  it("leaves flowchart lines without a protocol", () => {
    const a = addBlock();
    store().addBlock({ x: 200, y: 0 }, null, undefined, "decision");
    const decision = store().selectedNodeIds[0];
    const c = addBlock(400);
    store().updateConnection(store().addConnection({ source: a, target: decision })!, { protocol: "REST" });
    const id = store().addConnection({ source: decision, target: c })!;
    expect(view().edges!.find((edge) => edge.id === id)?.protocol).toBeUndefined();
  });
});

describe("L1 context in an internal design (L2)", () => {
  /** Orders talks to Payments (twice) and is called by Web; returns their ids. */
  function landscape() {
    const orders = addBlock();
    const payments = addBlock(300);
    const web = addBlock(-300);
    store().updateNodeLabel(orders, "Orders");
    store().updateNodeLabel(payments, "Payments");
    store().updateNodeLabel(web, "Web");
    store().updateNodeDetails(payments, { technology: "Stripe" });
    store().addConnection({ source: orders, target: payments, sourceSide: "right", targetSide: "left" });
    store().addConnection({ source: orders, target: payments, sourceSide: "bottom", targetSide: "bottom" });
    store().addConnection({ source: web, target: orders });
    return { orders, payments, web };
  }

  it("lists each neighbour once with all its connections", () => {
    const { orders, payments, web } = landscape();
    const section = store().diagram.sections[0];
    const component = section.nodes.find((node) => node.id === orders)!;
    const rows = l1Neighbours(section, component, []);
    expect(rows.map((row) => row.node.id)).toEqual([payments, web]);
    expect(rows[0].edges).toHaveLength(2);
    expect(rows.every((row) => !row.present)).toBe(true);
  });

  it("adds the missing neighbours in a dashed container, as one undo step, and only once", () => {
    const { orders } = landscape();
    store().openDetail(orders);
    const api = addBlock();
    store().updateNodeLabel(api, "web "); // already drawn, by name
    const before = store().past.length;

    expect(store().addL1Context()).toBe(1);
    expect(store().past.length).toBe(before + 1);

    const nodes = view().nodes;
    const container = nodes.find((node) => node.type === "container")!;
    expect(container.data).toMatchObject({ label: L1_CONTEXT_LABEL, outlineStyle: "dashed" });
    const stub = nodes.find((node) => node.parentId === container.id)!;
    expect(stub.data).toMatchObject({ label: "Payments", technology: "Stripe", containerId: container.id });
    expect(stub.position.x + stub.size.width).toBeLessThanOrEqual(container.size.width);
    expect(stub.position.y + stub.size.height).toBeLessThanOrEqual(container.size.height);
    expect(nodes.indexOf(container)).toBeLessThan(nodes.indexOf(stub));
    expect(store().selectedNodeIds).toEqual([stub.id]);
    expect(container.position.x).toBeGreaterThan(api ? nodes.find((node) => node.id === api)!.size.width : 0);

    expect(store().addL1Context()).toBe(0);
    expect(store().past.length).toBe(before + 1);
  });

  it("reuses the context container when another neighbour appears later", () => {
    const { orders } = landscape();
    store().openDetail(orders);
    store().addL1Context();
    store().closeDetail();
    const billing = addBlock(0, 300);
    store().updateNodeLabel(billing, "Billing");
    store().addConnection({ source: orders, target: billing });
    store().openDetail(orders);

    expect(store().addL1Context()).toBe(1);
    const containers = view().nodes.filter((node) => node.type === "container");
    expect(containers).toHaveLength(1);
    const children = view().nodes.filter((node) => node.parentId === containers[0].id);
    expect(children.map((node) => node.data.label)).toEqual(["Payments", "Web", "Billing"]);
    const bottoms = children.map((node: DiagramNode) => node.position.y + node.size.height);
    expect(Math.max(...bottoms)).toBeLessThanOrEqual(containers[0].size.height);
  });

  it("does nothing on a tab", () => {
    landscape();
    expect(store().addL1Context()).toBe(0);
  });

  it("saves a file that opens without repairs", () => {
    const { orders } = landscape();
    store().openDetail(orders);
    store().addL1Context();
    const parsed = parseDiagram(JSON.parse(JSON.stringify(store().diagram)));
    expect(parsed.fixes).toEqual([]);
  });
});
