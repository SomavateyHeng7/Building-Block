import { describe, expect, it } from "vitest";
import { searchDiagram } from "@/lib/diagram/search";
import { buildDiagram } from "@/templates/build";

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
