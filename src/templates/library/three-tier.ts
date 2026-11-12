import { buildDiagram, type CanvasSpec } from "../build";
import type { TemplateDefinition } from "../types";

/** What the Application Server is made of, so the template shows an internal design (L2). */
const APPLICATION_SERVER: CanvasSpec = {
  columns: [
    [{ label: "API", components: [{ label: "REST Controllers", colorKey: "product", technology: "Spring MVC" }] }],
    [
      {
        label: "Domain",
        components: [
          { label: "Business Services", colorKey: "product" },
          { label: "Authorization", colorKey: "enhancement", description: "Decides who may do what." },
        ],
      },
    ],
    [
      {
        label: "Integration",
        components: [
          { label: "Repositories", colorKey: "product", technology: "JPA" },
          { label: "Cache Client", colorKey: "new", technology: "Redis" },
          { label: "Token Validator", colorKey: "third-party", technology: "OIDC" },
        ],
      },
    ],
  ],
  connections: [
    { from: "REST Controllers", to: "Business Services", label: "Commands", protocol: "In-process" },
    { from: "Business Services", to: "Authorization", label: "Checks permissions", protocol: "In-process" },
    { from: "Business Services", to: "Repositories", label: "Reads and writes", protocol: "SQL" },
    { from: "Business Services", to: "Cache Client", label: "Sessions", protocol: "Redis" },
    { from: "Authorization", to: "Token Validator", label: "Validates tokens", protocol: "OIDC" },
  ],
};

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
          { label: "Application Server", colorKey: "product", technology: "Java / Spring Boot", detail: APPLICATION_SERVER },
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
    { from: "Load Balancer", to: "Application Server", label: "Routes requests", protocol: "HTTP" },
    { from: "Application Server", to: "Background Worker", label: "Queued jobs", protocol: "AMQP", dashed: true },
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
    "The classic presentation, application and data tiers, with an external identity provider and the connections between them. The Application Server has an internal design (L2) to open.",
  category: "Architecture",
  keywords: ["web", "tiers", "database", "l2"],
  build: () => buildDiagram("Three-tier Web Application", [{ name: "Overview", canvas: CANVAS }]),
};
