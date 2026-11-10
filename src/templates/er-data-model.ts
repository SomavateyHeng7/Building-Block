import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

/** Entities are components (their key fields under the name, as the technology line); domains are containers; connections say how many. */
const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Customers",
        components: [
          { label: "Customer", colorKey: "product", technology: "id, name, email" },
          { label: "Address", colorKey: "product", technology: "id, customer_id, street, city" },
        ],
      },
    ],
    [
      {
        label: "Orders",
        components: [
          { label: "Order Line", colorKey: "product", technology: "order_id, product_id, quantity, price" },
          { label: "Order", colorKey: "product", technology: "id, customer_id, placed_at, status" },
        ],
      },
      { label: "Billing", components: [{ label: "Payment", colorKey: "enhancement", technology: "id, order_id, amount, method" }] },
    ],
    [
      {
        label: "Catalogue",
        components: [
          { label: "Product", colorKey: "product", technology: "id, category_id, name, price" },
          { label: "Category", colorKey: "product", technology: "id, name" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Customer", to: "Address", label: "has (1 to many)" },
    { from: "Customer", to: "Order", label: "places (1 to many)" },
    { from: "Order", to: "Order Line", label: "contains (1 to many)" },
    { from: "Order", to: "Payment", label: "is paid by (1 to many)" },
    { from: "Order Line", to: "Product", label: "refers to (many to 1)" },
    { from: "Product", to: "Category", label: "belongs to (many to 1)" },
  ],
};

export const erDataModelTemplate: TemplateDefinition = {
  id: "er-data-model",
  name: "Data model (ER)",
  description:
    "The entities of an ordering system grouped by domain, with their key fields and how many of one relate to another.",
  category: "Architecture",
  keywords: ["er", "erd", "entity", "relationship", "database", "schema", "tables", "data model", "domain"],
  build: () => buildDiagram("Data Model", [{ name: "Overview", canvas: CANVAS }]),
};
