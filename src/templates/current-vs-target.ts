import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

const CURRENT: CanvasSpec = {
  columns: [
    [
      {
        label: "Channels",
        components: [
          { label: "Customer Website", colorKey: "product" },
          { label: "Call Centre Desktop", colorKey: "product" },
        ],
      },
    ],
    [
      {
        label: "Core Systems",
        components: [
          { label: "Legacy CRM", colorKey: "replacement", technology: "On-premises" },
          { label: "Billing System", colorKey: "product" },
          { label: "Nightly Reports", colorKey: "product", technology: "Batch" },
        ],
      },
    ],
    [{ label: "Integration", components: [{ label: "File Transfer", colorKey: "product", technology: "SFTP" }] }],
  ],
  connections: [
    { from: "Customer Website", to: "Legacy CRM", label: "Customer details", protocol: "SOAP" },
    { from: "Call Centre Desktop", to: "Legacy CRM", label: "Cases", protocol: "SOAP" },
    { from: "Billing System", to: "File Transfer", label: "Invoices", protocol: "CSV files", dashed: true },
  ],
};

const TARGET: CanvasSpec = {
  columns: [
    [
      {
        label: "Channels",
        components: [
          { label: "Customer Website", colorKey: "enhancement" },
          { label: "Mobile App", colorKey: "new" },
          { label: "Call Centre Desktop", colorKey: "product" },
        ],
      },
    ],
    [
      {
        label: "Core Systems",
        components: [
          { label: "Customer Service", colorKey: "microservice", technology: "Cloud", description: "Replaces the legacy CRM." },
          { label: "Billing System", colorKey: "product" },
          { label: "Analytics Platform", colorKey: "new" },
        ],
      },
    ],
    [
      {
        label: "Integration",
        components: [
          { label: "API Gateway", colorKey: "rest-api" },
          { label: "Event Bus", colorKey: "rest-api", technology: "Kafka" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Customer Website", to: "Customer Service", label: "Customer details", protocol: "REST" },
    { from: "Mobile App", to: "Customer Service", label: "Customer details", protocol: "REST" },
    { from: "Call Centre Desktop", to: "Customer Service", label: "Cases", protocol: "REST" },
    { from: "Billing System", to: "Event Bus", label: "Invoices", protocol: "Kafka", dashed: true },
  ],
};

export const currentVsTargetTemplate: TemplateDefinition = {
  id: "current-vs-target",
  name: "Current vs target state",
  description:
    "Two tabs: the landscape today and where it is going. Use Compare tabs to list what is added, removed and changed.",
  build: () =>
    buildDiagram("Current vs Target State", [
      { name: "Current", canvas: CURRENT },
      { name: "Target", canvas: TARGET },
    ]),
};
