import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Internet (untrusted)",
        components: [
          { label: "Users", colorKey: "product" },
          { label: "Partner Systems", colorKey: "third-party" },
        ],
      },
    ],
    [
      {
        label: "DMZ",
        components: [
          { label: "Web Application Firewall", colorKey: "rest-api", description: "Blocks common attacks before they reach the application." },
          { label: "API Gateway", colorKey: "rest-api", technology: "Rate limits, mTLS" },
        ],
      },
    ],
    [
      {
        label: "Application Zone",
        components: [
          { label: "Web Servers", colorKey: "product" },
          { label: "Internal APIs", colorKey: "microservice" },
        ],
      },
    ],
    [
      {
        label: "Data Zone",
        components: [
          { label: "Database", colorKey: "product", technology: "Encrypted at rest" },
          { label: "Backup Storage", colorKey: "new", technology: "Immutable copies" },
        ],
      },
      { label: "Security Operations", components: [{ label: "Security Monitoring", colorKey: "enhancement", technology: "SIEM" }] },
    ],
  ],
  connections: [
    { from: "Users", to: "Web Application Firewall", label: "Requests", protocol: "HTTPS" },
    { from: "Partner Systems", to: "API Gateway", label: "Partner calls", protocol: "mTLS" },
    { from: "Web Application Firewall", to: "Web Servers", label: "Filtered requests", protocol: "HTTPS" },
    { from: "API Gateway", to: "Internal APIs", label: "Authenticated calls", protocol: "HTTPS" },
    { from: "Web Servers", to: "Internal APIs", label: "Service calls", protocol: "HTTPS" },
    { from: "Internal APIs", to: "Database", label: "Reads and writes", protocol: "SQL over TLS" },
    { from: "Database", to: "Backup Storage", label: "Encrypted backups", dashed: true },
    { from: "Internal APIs", to: "Security Monitoring", label: "Audit logs", dashed: true },
  ],
};

export const securityZonesTemplate: TemplateDefinition = {
  id: "security-zones",
  name: "Network security zones",
  description:
    "Untrusted internet, a DMZ, the application zone and the data zone, with the controls where traffic crosses from one zone to the next.",
  category: "Architecture",
  keywords: ["security", "network", "zones", "dmz", "firewall", "trust", "boundary", "waf", "segmentation"],
  build: () => buildDiagram("Network Security Zones", [{ name: "Overview", canvas: CANVAS }]),
};
