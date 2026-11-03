import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Internet",
        components: [
          { label: "Users", colorKey: "product" },
          { label: "CDN and WAF", colorKey: "rest-api", description: "Caches static content and filters bad traffic." },
        ],
      },
    ],
    [
      {
        label: "Public Subnet",
        components: [
          { label: "Load Balancer", colorKey: "product" },
          { label: "NAT Gateway", colorKey: "new", description: "Outbound internet access for private subnets." },
        ],
      },
    ],
    [
      {
        label: "Private Subnet",
        components: [
          { label: "App Servers", colorKey: "product", technology: "Containers" },
          { label: "Background Workers", colorKey: "product" },
        ],
      },
    ],
    [
      {
        label: "Data Subnet",
        components: [
          { label: "Database", colorKey: "product", technology: "Managed SQL" },
          { label: "Cache", colorKey: "new", technology: "Redis" },
        ],
      },
      {
        label: "Shared Services",
        components: [
          { label: "Secrets Manager", colorKey: "enhancement" },
          { label: "Logging and Monitoring", colorKey: "enhancement" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Users", to: "CDN and WAF", label: "Requests", protocol: "HTTPS" },
    { from: "CDN and WAF", to: "Load Balancer", label: "Filtered traffic", protocol: "HTTPS" },
    { from: "Load Balancer", to: "App Servers", label: "Requests", protocol: "HTTP" },
    { from: "App Servers", to: "Database", label: "Reads and writes", protocol: "SQL" },
    { from: "App Servers", to: "Cache", label: "Sessions", protocol: "Redis" },
    { from: "App Servers", to: "Secrets Manager", label: "Fetch secrets", protocol: "HTTPS", dashed: true },
    { from: "Background Workers", to: "NAT Gateway", label: "Outbound calls", protocol: "HTTPS", dashed: true },
    { from: "App Servers", to: "Logging and Monitoring", label: "Logs and metrics", dashed: true },
  ],
};

export const cloudLandingZoneTemplate: TemplateDefinition = {
  id: "cloud-landing-zone",
  name: "Cloud landing zone",
  description: "Public, private and data subnets behind a CDN and load balancer, with shared secrets and monitoring.",
  category: "Architecture",
  keywords: ["cloud", "aws", "azure", "gcp", "network", "vpc", "subnet", "infrastructure", "security"],
  build: () => buildDiagram("Cloud Landing Zone", [{ name: "Overview", canvas: CANVAS }]),
};
