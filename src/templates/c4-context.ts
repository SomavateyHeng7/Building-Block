import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

/** What the Order Platform is made of, so the template shows an internal design (L2). */
const ORDER_PLATFORM: CanvasSpec = {
  columns: [
    [{ label: "Frontend", components: [{ label: "Web App", colorKey: "product", technology: "React" }] }],
    [{ label: "API", components: [{ label: "Order API", colorKey: "rest-api", technology: "REST" }] }],
    [
      {
        label: "Services",
        components: [
          { label: "Payment Adapter", colorKey: "third-party", description: "Hides the payment provider behind our own interface." },
          { label: "Order Service", colorKey: "microservice" },
          { label: "Notification Adapter", colorKey: "third-party" },
        ],
      },
    ],
    [{ label: "Data", components: [{ label: "Order Database", colorKey: "product", technology: "PostgreSQL" }] }],
  ],
  connections: [
    { from: "Web App", to: "Order API", label: "Requests", protocol: "HTTPS" },
    { from: "Order API", to: "Order Service", label: "Commands", protocol: "In-process" },
    { from: "Order Service", to: "Payment Adapter", label: "Takes payment", protocol: "In-process" },
    { from: "Order Service", to: "Notification Adapter", label: "Sends receipts", protocol: "In-process", dashed: true },
    { from: "Order Service", to: "Order Database", label: "Reads and writes", protocol: "SQL" },
  ],
};

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
            detail: ORDER_PLATFORM,
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
  description:
    "One system in the middle, the people who use it on one side and the external systems it depends on on the other. The Order Platform has an internal design (L2) to open.",
  category: "Architecture",
  keywords: ["c4", "context", "actors", "users", "boundary", "external", "l2"],
  build: () => buildDiagram("System Context", [{ name: "Context", canvas: CANVAS }]),
};
