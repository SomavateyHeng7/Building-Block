import { describe, expect, it } from "vitest";
import { highlightWords, searchDiagram, searchWords } from "@/lib/diagram/search";
import { buildDiagram } from "@/templates/build";
import { sequenceTemplate } from "@/templates/sequence";

const diagram = buildDiagram("Plan", [
  {
    name: "Current",
    canvas: {
      columns: [
        [{ label: "Channels", components: [{ label: "Web shop", colorKey: "product", technology: "React" }] }],
        [
          {
            label: "Core",
            components: [
              {
                label: "Orders",
                colorKey: "product",
                owner: "Team Kite",
                icon: "service",
                detail: {
                  columns: [[{ label: "Inside", components: [{ label: "Orders DB", colorKey: "product", technology: "PostgreSQL" }] }]],
                },
              },
              { label: "Shop analytics", colorKey: "third-party" },
            ],
          },
        ],
      ],
      connections: [{ from: "Web shop", to: "Orders", label: "Orders placed", protocol: "Kafka" }],
    },
  },
  { name: "Target", canvas: { columns: [[{ label: "Core", components: [{ label: "Orders", colorKey: "product" }] }]] } },
]);

const found = (query: string) => searchDiagram(diagram, query).map((result) => [result.kind, result.label, result.where, result.match]);

describe("searchDiagram", () => {
  it("finds nothing for a blank query", () => {
    expect(searchDiagram(diagram, "   ")).toEqual([]);
  });

  it("puts names that start with the query first, then names containing it, on every tab", () => {
    expect(found("shop")).toEqual([
      ["component", "Shop analytics", "Current", undefined],
      ["component", "Web shop", "Current", undefined],
    ]);
    expect(found("ORDERS").map(([, label, where]) => `${label} @ ${where}`)).toEqual([
      "Orders @ Current",
      "Orders DB @ Current › Orders",
      "Orders @ Target",
      "Web shop → Orders @ Current",
    ]);
  });

  it("finds things by their details and says which field matched", () => {
    expect(found("kite")).toEqual([["component", "Orders", "Current", "Owner: Team Kite"]]);
    expect(found("3rd party")).toEqual([["component", "Shop analytics", "Current", "Category: 3rd Party Systems"]]);
    expect(found("kafka")).toEqual([["connection", "Web shop → Orders", "Current", "Protocol: Kafka"]]);
  });

  it("looks inside internal designs and says how to get there", () => {
    const [result] = searchDiagram(diagram, "postgres");
    const orders = diagram.sections[0].nodes.find((node) => node.data.label === "Orders")!;
    expect(result).toMatchObject({ label: "Orders DB", sectionId: diagram.sections[0].id, detailId: orders.id });
  });
});

describe("searching with several words, and accents", () => {
  it("finds what has every word, in any order, across its name and details", () => {
    // Both words in the name, out of order: after names that hold the phrase itself.
    expect(found("shop web")).toEqual([["component", "Web shop", "Current", undefined]]);
    // A word from the name and one from a field.
    expect(found("orders kite")).toEqual([["component", "Orders", "Current", "Owner: Team Kite"]]);
    // A connection's end and what it carries; its ends alone don't find it.
    expect(found("orders kafka")).toEqual([["connection", "Web shop → Orders", "Current", "Protocol: Kafka"]]);
    expect(found("web orders").map(([kind]) => kind)).not.toContain("connection");
    expect(found("orders nothing-like-this")).toEqual([]);
  });

  it("ignores accents in the query and the diagram", () => {
    const accented = buildDiagram("Café", [
      { name: "Main", canvas: { columns: [[{ label: "Core", components: [{ label: "Café menu", colorKey: "product", technology: "Señal" }] }]] } },
    ]);
    expect(searchDiagram(accented, "cafe").map((result) => result.label)).toEqual(["Café menu"]);
    expect(searchDiagram(accented, "SENAL")[0]).toMatchObject({ label: "Café menu", match: "Technology: Señal" });
  });

  it("sees edits: a changed diagram is searched afresh", () => {
    expect(found("ledger")).toEqual([]);
    const edited = { ...diagram, sections: diagram.sections.map((section, index) => (index === 1 ? { ...section, name: "Later" } : section)) };
    edited.sections[1] = {
      ...edited.sections[1],
      nodes: edited.sections[1].nodes.map((node) => (node.data.label === "Orders" ? { ...node, data: { ...node.data, label: "Ledger" } } : node)),
    };
    expect(searchDiagram(edited, "ledger").map((result) => `${result.label} @ ${result.where}`)).toEqual(["Ledger @ Later"]);
    expect(found("ledger")).toEqual([]);
  });
});

describe("highlightWords", () => {
  const marked = (text: string, query: string) =>
    highlightWords(text, searchWords(query)).map((part) => (part.mark ? `[${part.text}]` : part.text)).join("");

  it("marks every word, ignoring case and accents, and keeps the text as it was", () => {
    expect(marked("Orders → Orders DB", "orders")).toBe("[Orders] → [Orders] DB");
    expect(marked("Café menu", "cafe men")).toBe("[Café] [men]u");
    expect(marked("Web shop", "")).toBe("Web shop");
    expect(marked("Protocol: Kafka", "x")).toBe("Protocol: Kafka");
  });
});

describe("searching sequence tabs", () => {
  it("finds participants by name or description, messages by what's sent, and notes by their text", () => {
    const diagram = sequenceTemplate.build();
    const section = diagram.sections[0];
    const kinds = (query: string) => searchDiagram(diagram, query).map((result) => [result.kind, result.label]);
    // The participant by its name first, then the steps that say it, in order (not those that merely touch it).
    expect(kinds("order")).toEqual([
      ["participant", "Orders Service"],
      ["message", "Customer → Web Shop"],
      ["message", "Web Shop → Orders Service"],
      ["note", "Retries twice if the gateway times out, then cancels the …"],
      ["message", "Orders Service → Notification Service"],
      ["message", "Orders Service → Web Shop"],
    ]);
    expect(searchDiagram(diagram, "kafka")[0]).toMatchObject({ kind: "message", match: "Protocol: Kafka", sectionId: section.id });
    expect(searchDiagram(diagram, "retries")[0]).toMatchObject({ kind: "note", where: "Checkout › note over Orders Service" });
  });
});
