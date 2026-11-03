import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Sources",
        components: [
          { label: "Operational Database", colorKey: "product", technology: "PostgreSQL" },
          { label: "SaaS Application", colorKey: "third-party" },
          { label: "Event Stream", colorKey: "rest-api", technology: "Kafka" },
        ],
      },
    ],
    [
      {
        label: "Ingestion",
        components: [
          { label: "Batch Loader", colorKey: "new", technology: "Scheduled jobs" },
          { label: "Stream Processor", colorKey: "new", technology: "Flink" },
        ],
      },
    ],
    [
      { label: "Raw Zone", components: [{ label: "Data Lake", colorKey: "product", technology: "Object storage" }] },
      { label: "Curated Zone", components: [{ label: "Data Warehouse", colorKey: "product" }] },
    ],
    [
      {
        label: "Consumption",
        components: [
          { label: "BI Dashboards", colorKey: "enhancement" },
          { label: "ML Models", colorKey: "ai-focus" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Operational Database", to: "Batch Loader", label: "Nightly extract", protocol: "SQL" },
    { from: "SaaS Application", to: "Batch Loader", label: "API export", protocol: "HTTPS" },
    { from: "Event Stream", to: "Stream Processor", label: "Events", protocol: "Kafka", dashed: true },
    { from: "Batch Loader", to: "Data Lake", label: "Raw files" },
    { from: "Stream Processor", to: "Data Lake", label: "Raw events", dashed: true },
    { from: "Data Lake", to: "Data Warehouse", label: "Cleaned and modelled" },
    { from: "Data Warehouse", to: "BI Dashboards", label: "Queries", protocol: "SQL" },
    { from: "Data Lake", to: "ML Models", label: "Training data" },
  ],
};

export const dataPipelineTemplate: TemplateDefinition = {
  id: "data-pipeline",
  name: "Data pipeline",
  description: "Sources flow through batch and streaming ingestion into a lake and warehouse, then out to dashboards and models.",
  category: "Architecture",
  keywords: ["etl", "elt", "analytics", "lake", "warehouse", "streaming", "bi", "machine learning"],
  build: () => buildDiagram("Data Pipeline", [{ name: "Overview", canvas: CANVAS }]),
};
