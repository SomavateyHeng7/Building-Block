import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Presentation Tier",
        components: [
          { label: "Web Front End", colorKey: "product", technology: "React" },
          { label: "Admin Console", colorKey: "enhancement", technology: "React" },
        ],
      },
    ],
    [
      {
        label: "Application Tier",
        components: [
          { label: "Load Balancer", colorKey: "product" },
          { label: "Application Server", colorKey: "product", technology: "Java / Spring Boot" },
          { label: "Background Worker", colorKey: "new", technology: "Java" },
        ],
      },
    ],
    [
      {
        label: "Data Tier",
        components: [
          { label: "Primary Database", colorKey: "product", technology: "PostgreSQL" },
          { label: "Cache", colorKey: "new", technology: "Redis" },
          { label: "File Storage", colorKey: "third-party", technology: "Object storage" },
        ],
      },
      {
        label: "External Services",
        components: [{ label: "Identity Provider", colorKey: "third-party", technology: "OIDC" }],
      },
    ],
  ],
  connections: [
    { from: "Web Front End", to: "Load Balancer", label: "Requests", protocol: "HTTPS" },
    { from: "Admin Console", to: "Load Balancer", label: "Admin requests", protocol: "HTTPS" },
    { from: "Application Server", to: "Identity Provider", label: "Token checks", protocol: "OIDC" },
    { from: "Application Server", to: "Primary Database", label: "Reads and writes", protocol: "SQL" },
    { from: "Application Server", to: "Cache", label: "Sessions", protocol: "Redis" },
    { from: "Background Worker", to: "File Storage", label: "Reports", protocol: "HTTPS", dashed: true },
  ],
};

export const threeTierTemplate: TemplateDefinition = {
  id: "three-tier",
  name: "Three-tier web application",
  description:
    "The classic presentation, application and data tiers, with an external identity provider and the connections between them.",
  build: () => buildDiagram("Three-tier Web Application", [{ name: "Overview", canvas: CANVAS }]),
};
