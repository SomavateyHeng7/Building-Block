import { downloadDiagramJson } from "./file";
import type { Diagram } from "./types";
import { parseDiagram } from "./validate";

/**
 * Earlier versions kept diagrams and templates in this browser's localStorage. The app no longer stores
 * anything, so this only finds what is still there to let people download it before removing it.
 */
const PREFIXES = ["bb:diagram:"];
const OTHER_KEYS = ["bb:index", "bb:backups", "bb:templates"];

export interface LegacyItem {
  key: string;
  name: string;
  kind: "diagram" | "template";
  diagram: Diagram;
}

export function readLegacyItems(): LegacyItem[] {
  if (typeof window === "undefined") return [];
  const items: LegacyItem[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && PREFIXES.some((prefix) => key.startsWith(prefix))) {
        try {
          const { diagram } = parseDiagram(JSON.parse(window.localStorage.getItem(key) ?? ""));
          items.push({ key, name: diagram.name, kind: "diagram", diagram });
        } catch {
          // Unreadable entry: leave it alone.
        }
      }
    }
    const templates = JSON.parse(window.localStorage.getItem("bb:templates") ?? "[]") as { id: string; name: string; diagram: unknown }[];
    for (const template of templates) {
      try {
        const { diagram } = parseDiagram(template.diagram);
        items.push({ key: `bb:template:${template.id}`, name: template.name, kind: "template", diagram: { ...diagram, name: template.name } });
      } catch {
        // Skip a template that can't be read.
      }
    }
  } catch {
    // Storage blocked: nothing to migrate.
  }
  return items;
}

export function downloadLegacyItem(item: LegacyItem): void {
  downloadDiagramJson(item.diagram);
}

/** Deletes every copy the old version left in this browser. */
export function removeLegacyItems(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key);
    }
    [...keys, ...OTHER_KEYS].forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Nothing to remove, or storage is blocked.
  }
}
