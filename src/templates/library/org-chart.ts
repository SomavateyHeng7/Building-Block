import { buildDiagram, type CanvasSpec } from "../build";
import type { TemplateDefinition } from "../types";

/** One container per level, reporting lines as connections between neighbouring levels. */
const CANVAS: CanvasSpec = {
  columns: [
    [{ label: "Leadership", components: [{ label: "Chief Executive", colorKey: "enhancement" }] }],
    [
      {
        label: "Directors",
        components: [
          { label: "Director of Engineering", colorKey: "product" },
          { label: "Director of Product", colorKey: "product" },
          { label: "Director of Operations", colorKey: "product" },
        ],
      },
    ],
    [
      {
        label: "Managers",
        components: [
          { label: "Platform Manager", colorKey: "microservice" },
          { label: "Application Manager", colorKey: "microservice" },
          { label: "Design Manager", colorKey: "microservice" },
          { label: "Support Manager", colorKey: "microservice" },
        ],
      },
    ],
    [
      {
        label: "Teams",
        components: [
          { label: "Platform Team", colorKey: "new", description: "Infrastructure, build and release." },
          { label: "Application Team", colorKey: "new", description: "Web and mobile features." },
          { label: "Design Team", colorKey: "new" },
          { label: "Support Team", colorKey: "new" },
        ],
      },
    ],
  ],
  connections: [
    { from: "Chief Executive", to: "Director of Engineering", label: "Manages" },
    { from: "Chief Executive", to: "Director of Product", label: "Manages" },
    { from: "Chief Executive", to: "Director of Operations", label: "Manages" },
    { from: "Director of Engineering", to: "Platform Manager", label: "Manages" },
    { from: "Director of Engineering", to: "Application Manager", label: "Manages" },
    { from: "Director of Product", to: "Design Manager", label: "Manages" },
    { from: "Director of Operations", to: "Support Manager", label: "Manages" },
    { from: "Platform Manager", to: "Platform Team", label: "Leads" },
    { from: "Application Manager", to: "Application Team", label: "Leads" },
    { from: "Design Manager", to: "Design Team", label: "Leads" },
    { from: "Support Manager", to: "Support Team", label: "Leads" },
  ],
};

export const orgChartTemplate: TemplateDefinition = {
  id: "org-chart",
  name: "Org chart",
  description: "Who reports to whom: leadership, directors, managers and their teams, one level per column.",
  category: "Planning",
  keywords: ["organisation", "organization", "org", "reporting", "hierarchy", "team", "structure", "people"],
  build: () => buildDiagram("Org Chart", [{ name: "Overview", canvas: CANVAS }]),
};
