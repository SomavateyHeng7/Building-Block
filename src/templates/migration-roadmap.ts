import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

const CURRENT: CanvasSpec = {
  columns: [
    [{ label: "Channels", components: [{ label: "Customer Portal", colorKey: "product" }] }],
    [{ label: "Core", components: [{ label: "Monolith", colorKey: "replacement", technology: "Single deployable" }] }],
    [{ label: "Data", components: [{ label: "Shared Database", colorKey: "product" }] }],
  ],
  connections: [
    { from: "Customer Portal", to: "Monolith", label: "Requests", protocol: "HTTPS" },
    { from: "Monolith", to: "Shared Database", label: "Reads and writes", protocol: "SQL" },
  ],
};

const TRANSITION: CanvasSpec = {
  columns: [
    [{ label: "Channels", components: [{ label: "Customer Portal", colorKey: "product" }] }],
    [
      {
        label: "Routing",
        components: [{ label: "API Gateway", colorKey: "new", description: "Sends each feature to the old or the new service." }],
      },
    ],
    [
      { label: "Legacy", components: [{ label: "Monolith", colorKey: "replacement", technology: "Single deployable" }] },
      { label: "New Services", components: [{ label: "Order Service", colorKey: "new" }] },
    ],
    [
      { label: "Legacy Data", components: [{ label: "Shared Database", colorKey: "product" }] },
      { label: "New Data", components: [{ label: "Order Database", colorKey: "new" }] },
    ],
  ],
  connections: [
    { from: "Customer Portal", to: "API Gateway", label: "Requests", protocol: "HTTPS" },
    { from: "API Gateway", to: "Monolith", label: "Features not moved yet", protocol: "HTTP" },
    { from: "API Gateway", to: "Order Service", label: "Order features", protocol: "HTTP" },
    { from: "Monolith", to: "Shared Database", label: "Reads and writes", protocol: "SQL" },
    { from: "Order Service", to: "Order Database", label: "Reads and writes", protocol: "SQL" },
    { from: "Order Service", to: "Shared Database", label: "Copy data while moving", protocol: "SQL", dashed: true },
  ],
};

const TARGET: CanvasSpec = {
  columns: [
    [{ label: "Channels", components: [{ label: "Customer Portal", colorKey: "product" }] }],
    [{ label: "Routing", components: [{ label: "API Gateway", colorKey: "enhancement" }] }],
    [
      {
        label: "Services",
        components: [
          { label: "Order Service", colorKey: "microservice" },
          { label: "Customer Service", colorKey: "microservice" },
        ],
      },
    ],
    [
      {
        label: "Data",
        components: [
          { label: "Order Database", colorKey: "product" },
          { label: "Customer Database", colorKey: "product" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Customer Portal", to: "API Gateway", label: "Requests", protocol: "HTTPS" },
    { from: "API Gateway", to: "Order Service", label: "Order features", protocol: "HTTP" },
    { from: "API Gateway", to: "Customer Service", label: "Customer features", protocol: "HTTP" },
    { from: "Order Service", to: "Order Database", label: "Reads and writes", protocol: "SQL" },
    { from: "Customer Service", to: "Customer Database", label: "Reads and writes", protocol: "SQL" },
  ],
};

export const migrationRoadmapTemplate: TemplateDefinition = {
  id: "migration-roadmap",
  name: "Migration roadmap",
  description:
    "Three tabs, Current, Transition and Target, for moving off a monolith step by step. Use Compare tabs to see each step's changes.",
  category: "Planning",
  keywords: ["roadmap", "migration", "monolith", "strangler", "phases", "modernisation", "compare"],
  build: () =>
    buildDiagram("Migration Roadmap", [
      { name: "Current", canvas: CURRENT },
      { name: "Transition", canvas: TRANSITION },
      { name: "Target", canvas: TARGET },
    ]),
};
