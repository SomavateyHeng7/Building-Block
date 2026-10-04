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
