import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

/** What the warehouse is made of, so the template shows an internal design (L2). */
const WAREHOUSE: CanvasSpec = {
  columns: [
    [{ label: "Raw", components: [{ label: "Raw Tables", colorKey: "product", description: "Loaded as delivered, never edited." }] }],
    [
      {
        label: "Transform",
        components: [
          { label: "Staging Models", colorKey: "new", technology: "dbt", description: "Rename, cast and de-duplicate." },
          { label: "Mart Models", colorKey: "new", technology: "dbt", description: "Joined and aggregated for the business." },
        ],
      },
    ],
    [
      {
        label: "Serve",
        components: [
          { label: "Semantic Layer", colorKey: "enhancement", description: "One definition of each metric." },
          { label: "Quality Tests", colorKey: "enhancement", technology: "dbt tests" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Raw Tables", to: "Staging Models", label: "Cleans", protocol: "SQL" },
    { from: "Staging Models", to: "Mart Models", label: "Joins and aggregates", protocol: "SQL" },
    { from: "Mart Models", to: "Semantic Layer", label: "Metrics", protocol: "SQL" },
    { from: "Mart Models", to: "Quality Tests", label: "Checks", protocol: "SQL", dashed: true },
  ],
};

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
          { label: "Data Warehouse", colorKey: "product", technology: "Snowflake, dbt models", detail: WAREHOUSE },
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
  description: "From sources through ingestion (change capture, batch connectors, an event stream) to a lake and a warehouse, then models, dashboards and reverse ETL. The Data Warehouse has an internal design (L2) to open.",
  category: "Architecture",
  keywords: ["data","analytics","warehouse","lake","etl","dashboards", "l2"],
  build: () => buildDiagram("Data and Analytics Platform", [{ name: "Overview", canvas: CANVAS }]),
};
