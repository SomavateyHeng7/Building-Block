import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

// Rows line up across columns (database → CDC → lake → models; SaaS → connectors → warehouse → dashboards), so
// most connections run straight across.
const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Sources",
        components: [
          { label: "Operational Databases", colorKey: "product", technology: "PostgreSQL" },
          { label: "SaaS Applications", colorKey: "third-party", technology: "CRM, billing" },
          { label: "Clickstream", colorKey: "product", technology: "Web and app events" },
        ],
      },
    ],
    [
      {
        label: "Ingestion",
        components: [
          { label: "Change Data Capture", colorKey: "new", technology: "Debezium" },
          { label: "Batch Connectors", colorKey: "third-party", technology: "Fivetran" },
          { label: "Event Stream", colorKey: "rest-api", technology: "Kafka" },
        ],
      },
    ],
    [
      {
        label: "Storage and Processing",
        components: [
          { label: "Data Lake", colorKey: "product", technology: "Object storage, Parquet" },
          { label: "Data Warehouse", colorKey: "product", technology: "Snowflake, dbt models" },
        ],
      },
    ],
    [
      {
        label: "Consumers",
        components: [
          { label: "ML Models", colorKey: "ai-focus", technology: "Feature store" },
          { label: "BI Dashboards", colorKey: "product", technology: "Looker" },
          { label: "Reverse ETL", colorKey: "new", technology: "Back to the CRM" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Operational Databases", to: "Change Data Capture", label: "Row changes", protocol: "WAL" },
    { from: "SaaS Applications", to: "Batch Connectors", label: "Records", protocol: "REST", dashed: true },
    { from: "Clickstream", to: "Event Stream", label: "Events", protocol: "Kafka", dashed: true },
    { from: "Change Data Capture", to: "Data Lake", label: "Change events", protocol: "Kafka", dashed: true },
    { from: "Batch Connectors", to: "Data Warehouse", label: "Raw tables", protocol: "SQL" },
    { from: "Event Stream", to: "Data Lake", label: "Raw events", protocol: "Kafka Connect", dashed: true },
    { from: "Data Lake", to: "ML Models", label: "Training data", protocol: "Parquet" },
    { from: "Data Warehouse", to: "BI Dashboards", label: "Metrics", protocol: "SQL" },
    { from: "Data Warehouse", to: "Reverse ETL", label: "Segments", protocol: "SQL", dashed: true },
  ],
};

export const dataPlatformTemplate: TemplateDefinition = {
  id: "data-platform",
  name: "Data and analytics platform",
  description: "From sources through ingestion (change capture, batch connectors, an event stream) to a lake and a warehouse, then models, dashboards and reverse ETL.",
  build: () => buildDiagram("Data and Analytics Platform", [{ name: "Overview", canvas: CANVAS }]),
};
