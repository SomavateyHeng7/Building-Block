import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "People",
        components: [
          { label: "Customer", colorKey: "product", description: "Places and tracks orders." },
          { label: "Support Agent", colorKey: "product", description: "Helps customers and fixes orders." },
        ],
      },
    ],
    [
      {
        label: "Our System",
        components: [
          {
            label: "Order Platform",
            colorKey: "enhancement",
            description: "Takes orders, takes payment and keeps customers informed.",
          },
        ],
      },
    ],
    [
      {
        label: "External Systems",
        components: [
          { label: "Payment Provider", colorKey: "third-party" },
          { label: "Email Service", colorKey: "third-party" },
          { label: "Identity Provider", colorKey: "third-party" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Customer", to: "Order Platform", label: "Places orders", protocol: "HTTPS" },
    { from: "Support Agent", to: "Order Platform", label: "Manages orders", protocol: "HTTPS" },
    { from: "Order Platform", to: "Payment Provider", label: "Takes payment", protocol: "REST" },
    { from: "Order Platform", to: "Email Service", label: "Sends receipts", protocol: "SMTP", dashed: true },
    { from: "Order Platform", to: "Identity Provider", label: "Signs people in", protocol: "OIDC" },
  ],
};

export const c4ContextTemplate: TemplateDefinition = {
  id: "c4-context",
  name: "System context (C4)",
  description: "One system in the middle, the people who use it on one side and the external systems it depends on on the other.",
  category: "Architecture",
  keywords: ["c4", "context", "actors", "users", "boundary", "external"],
  build: () => buildDiagram("System Context", [{ name: "Context", canvas: CANVAS }]),
};
