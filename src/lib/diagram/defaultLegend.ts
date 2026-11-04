import type { LegendEntry } from "./types";

export const DEFAULT_LEGEND: LegendEntry[] = [
  { key: "product", label: "Product Components", color: "#8fd19e" },
  { key: "replacement", label: "Replacement Components", color: "#e0536f" },
  { key: "enhancement", label: "Enhancement Components", color: "#f6d860" },
  { key: "new", label: "New Components", color: "#9ca3af" },
  { key: "microservice", label: "Microservices", color: "#1f7a4d" },
  { key: "non-existent", label: "Non-Existent Components", color: "#ffffff" },
  { key: "ai-focus", label: "AI Focus Components", color: "#7c3aed" },
  { key: "rest-api", label: "REST API/Decoupling", color: "#b8860b" },
  { key: "third-party", label: "3rd Party Systems", color: "#e5e7eb" },
];

/** A set of categories from a modelling standard, offered in the legend to add to a diagram. */
export interface LegendPreset {
  id: string;
  name: string;
  /** One line on what the colours mean. */
  hint: string;
  entries: { label: string; color: string }[];
}

export const LEGEND_PRESETS: LegendPreset[] = [
  {
    id: "c4",
    name: "C4 model",
    hint: "Person, software system, container and component, in the C4 colours",
    entries: [
      { label: "Person", color: "#08427b" },
      { label: "Software system", color: "#1168bd" },
      { label: "External software system", color: "#999999" },
      { label: "Container", color: "#438dd5" },
      { label: "Component", color: "#85bbf0" },
    ],
  },
  {
    id: "archimate",
    name: "ArchiMate layers",
    hint: "Business, application, technology and the other layers, in the ArchiMate colours",
    entries: [
      { label: "Strategy", color: "#f5deaa" },
      { label: "Business", color: "#ffffb5" },
      { label: "Application", color: "#b5ffff" },
      { label: "Technology", color: "#c9e7b7" },
      { label: "Motivation", color: "#ccccff" },
      { label: "Implementation and migration", color: "#ffe0e0" },
    ],
  },
];
