import type { Diagram } from "@/lib/diagram/types";
import type { Orientation } from "./build";

export type { Orientation };

/** Groups on the templates page, in the order the filter chips show them. */
export const TEMPLATE_CATEGORIES = ["Basics", "Architecture", "Process", "Planning", "Sequence"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface TemplateOptions {
  /** Only used by templates with `orientable` set. */
  orientation?: Orientation;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  /** Extra words people might search for, beyond the name and description. */
  keywords?: string[];
  /** Lanes can run vertically (columns) or horizontally (rows). */
  orientable?: boolean;
  /** Tabs (by name) to open with their differences marked, as Compare tabs does. */
  compare?: { from: string; to: string };
  build: (options?: TemplateOptions) => Diagram;
  /** Left off the start page and /templates for now; still built and tested, and back by removing this. */
  hidden?: boolean;
}
