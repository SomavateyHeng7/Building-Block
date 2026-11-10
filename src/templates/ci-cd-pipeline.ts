import { buildDiagram, type CanvasSpec } from "./build";
import type { TemplateDefinition } from "./types";

const CANVAS: CanvasSpec = {
  columns: [
    [
      {
        label: "Code",
        components: [
          { label: "Developers", colorKey: "product" },
          { label: "Source Repository", colorKey: "product", technology: "Git" },
        ],
      },
    ],
    [
      {
        label: "Build",
        components: [
          { label: "CI Runner", colorKey: "new", technology: "Pipeline jobs" },
          { label: "Artifact Registry", colorKey: "product", technology: "Container images" },
        ],
      },
    ],
    [
      {
        label: "Verify",
        components: [
          { label: "Automated Tests", colorKey: "enhancement", technology: "Unit, integration" },
          { label: "Security Scanner", colorKey: "enhancement", technology: "Dependencies, images" },
        ],
      },
    ],
    [
      {
        label: "Environments",
        components: [
          { label: "Staging", colorKey: "product" },
          { label: "Production", colorKey: "product", description: "Promoted only after approval." },
        ],
      },
    ],
    [{ label: "Operations", components: [{ label: "Monitoring", colorKey: "microservice", technology: "Metrics, logs, alerts" }] }],
  ],
  connections: [
    { from: "Developers", to: "Source Repository", label: "Push commits", protocol: "Git" },
    { from: "Source Repository", to: "CI Runner", label: "Triggers build", protocol: "Webhook" },
    { from: "CI Runner", to: "Artifact Registry", label: "Publishes image", protocol: "HTTPS" },
    { from: "CI Runner", to: "Automated Tests", label: "Runs tests", protocol: "Pipeline job" },
    { from: "Artifact Registry", to: "Security Scanner", label: "Scans image", protocol: "HTTPS" },
    { from: "Automated Tests", to: "Staging", label: "Deploys candidate", protocol: "Deploy job" },
    { from: "Security Scanner", to: "Staging", label: "Passes the gate", protocol: "Policy check" },
    { from: "Staging", to: "Production", label: "Promote after approval", protocol: "Deploy job" },
    { from: "Production", to: "Monitoring", label: "Metrics and logs", protocol: "Agent", dashed: true },
  ],
};

export const ciCdPipelineTemplate: TemplateDefinition = {
  id: "ci-cd-pipeline",
  name: "CI/CD pipeline",
  description: "From a commit through build, tests and a security scan to staging and production, with monitoring at the end.",
  category: "Architecture",
  keywords: ["ci", "cd", "devops", "build", "deploy", "release", "pipeline", "git", "delivery"],
  build: () => buildDiagram("CI/CD Pipeline", [{ name: "Overview", canvas: CANVAS }]),
};
