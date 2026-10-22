/**
 * The icons a component can show beside its name. Built in as SVG paths (24×24 grid, drawn with a stroke) so
 * they work offline, need no CDN, and come out in every export. Files store the key, so keys never change;
 * a label or drawing can.
 */
export const COMPONENT_ICONS = [
  { key: "service", label: "Service", path: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01" },
  { key: "api", label: "API or gateway", path: "M8 6l-6 6 6 6M16 6l6 6-6 6M14 4l-4 16" },
  { key: "web", label: "Web app", path: "M3 5h18v14H3zM3 9h18M6 7h.01M9 7h.01" },
  { key: "mobile", label: "Mobile app", path: "M7 2h10v20H7zM11 18h2" },
  {
    key: "database",
    label: "Database",
    path: "M4 6a8 3 0 1 0 16 0a8 3 0 1 0-16 0M4 6v12a8 3 0 0 0 16 0V6M4 12a8 3 0 0 0 16 0",
  },
  { key: "cache", label: "Cache", path: "M13 2 4 14h7l-1 8 9-12h-7z" },
  { key: "storage", label: "File or object storage", path: "M3 6h6l2 2h10v11H3z" },
  { key: "queue", label: "Queue", path: "M2 7h20v10H2zM7 7v10M12 7v10M17 7v10" },
  { key: "event", label: "Event stream", path: "M2 12h4l3-7 6 14 3-7h4" },
  { key: "function", label: "Function or serverless", path: "M6 4h3l9 16M12 11l-6 9" },
  { key: "scheduler", label: "Scheduler or batch", path: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 2" },
  { key: "analytics", label: "Analytics or reporting", path: "M3 21h18M6 17v-6M11 17V5M16 17v-9M21 17v-3" },
  { key: "identity", label: "Identity or security", path: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" },
  { key: "notification", label: "Email or notification", path: "M3 5h18v14H3zM3 5l9 8 9-8" },
  { key: "user", label: "User or actor", path: "M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0" },
  {
    key: "external",
    label: "External system",
    path: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3",
  },
  { key: "cloud", label: "Cloud service", path: "M7 19a5 5 0 0 1-.9-9.9A6 6 0 0 1 17.7 9 4.5 4.5 0 0 1 17.5 19z" },
] as const;

export type ComponentIconKey = (typeof COMPONENT_ICONS)[number]["key"];

export const COMPONENT_ICON_KEYS: readonly ComponentIconKey[] = COMPONENT_ICONS.map((icon) => icon.key);

export function componentIcon(key: string | undefined) {
  return COMPONENT_ICONS.find((icon) => icon.key === key);
}
