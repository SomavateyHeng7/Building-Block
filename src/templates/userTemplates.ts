import { createId } from "@/lib/diagram/factory";
import type { Diagram } from "@/lib/diagram/types";

const TEMPLATES_KEY = "bb:templates";

export interface UserTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  diagram: Diagram;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readTemplates(): UserTemplate[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    return raw ? (JSON.parse(raw) as UserTemplate[]) : [];
  } catch {
    return [];
  }
}

function writeTemplates(templates: UserTemplate[]): boolean {
  try {
    window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    return false;
  }
  cached = templates;
  listeners.forEach((listener) => listener());
  return true;
}

const listeners = new Set<() => void>();
let cached: UserTemplate[] = readTemplates();
const EMPTY: UserTemplate[] = [];

export function subscribeUserTemplates(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUserTemplatesSnapshot(): UserTemplate[] {
  return cached;
}

export function getUserTemplatesServerSnapshot(): UserTemplate[] {
  return EMPTY;
}

export function saveUserTemplate(diagram: Diagram, name: string, description = ""): boolean {
  if (!isBrowser()) return false;
  const template: UserTemplate = {
    id: createId("template"),
    name,
    description: description || `${diagram.sections.length} section(s), ${diagram.legend.length} legend entries`,
    createdAt: new Date().toISOString(),
    diagram,
  };
  return writeTemplates([template, ...readTemplates()]);
}

export function deleteUserTemplate(id: string): void {
  if (!isBrowser()) return;
  void writeTemplates(readTemplates().filter((template) => template.id !== id));
}

/** A fresh diagram from a saved template: new id and timestamps, named after the template. */
export function diagramFromUserTemplate(template: UserTemplate): Diagram {
  const now = new Date().toISOString();
  return { ...structuredClone(template.diagram), id: createId("diagram"), name: template.name, createdAt: now, updatedAt: now };
}
