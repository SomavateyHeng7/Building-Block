import { buildDiagram, type CanvasSpec } from "../build";
import type { TemplateDefinition } from "../types";

const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Digital Engagement Channels",
        components: [
          { label: "Customer Portal", colorKey: "product" },
          { label: "Mobile App", colorKey: "product" },
          { label: "Chatbot Assistant", colorKey: "ai-focus" },
          { label: "Partner Mini Apps", colorKey: "third-party" },
        ],
      },
    ],
    [
      {
        label: "Core Systems",
        components: [
          { label: "Customer Profile Service", colorKey: "microservice" },
          { label: "Billing Engine", colorKey: "replacement" },
          { label: "Order Management", colorKey: "enhancement" },
          { label: "Loyalty Service", colorKey: "new" },
        ],
      },
    ],
    [
      {
        label: "Integration Layer",
        components: [
          { label: "API Gateway", colorKey: "rest-api" },
          { label: "Event Bus", colorKey: "rest-api" },
          { label: "Legacy Adapter", colorKey: "non-existent" },
        ],
      },
    ],
    [
      {
        label: "Network & Infrastructure",
        components: [
          { label: "Core Network", colorKey: "product" },
          { label: "Cloud Hosting", colorKey: "third-party" },
          { label: "Monitoring & Observability", colorKey: "microservice" },
        ],
      },
    ],
  ],
  // A few example connections between neighbouring layers, so the template shows what L1 looks like.
  connections: [
    { from: "Customer Portal", to: "Customer Profile Service", label: "Profile data", protocol: "REST" },
    { from: "Mobile App", to: "Order Management", label: "Orders", protocol: "REST" },
    { from: "Chatbot Assistant", to: "Customer Profile Service", label: "Looks up customers", protocol: "REST" },
    { from: "Partner Mini Apps", to: "Loyalty Service", label: "Awards points", protocol: "REST" },
    { from: "API Gateway", to: "Billing Engine", label: "Invoices", protocol: "REST" },
    { from: "Order Management", to: "Event Bus", label: "Order events", protocol: "Kafka", dashed: true },
    { from: "Event Bus", to: "Legacy Adapter", label: "Legacy events", protocol: "File drop", dashed: true },
    { from: "Legacy Adapter", to: "Core Network", label: "Legacy traffic", protocol: "TCP" },
    { from: "Event Bus", to: "Cloud Hosting", label: "Runs on", protocol: "Managed service", dashed: true },
    { from: "API Gateway", to: "Monitoring & Observability", label: "Metrics and logs", protocol: "OpenTelemetry", dashed: true },
  ],
};

export const l0ArchitectureTemplate: TemplateDefinition = {
  id: "l0-architecture",
  name: "L0 Architecture",
  description:
    "A generic multi-layer system architecture: engagement channels, core systems, integration layer, and infrastructure, color-coded by component type, with a few example connections.",
  category: "Architecture",
  keywords: ["layers", "overview"],
  build: () => buildDiagram("L0 Architecture", [{ name: "Overview", canvas: CANVAS }]),
};
