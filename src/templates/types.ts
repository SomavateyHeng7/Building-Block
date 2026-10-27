import type { Diagram } from "@/lib/diagram/types";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  build: () => Diagram;
  /** Left off the start page and /templates for now; still built and tested, and back by removing this. */
  hidden?: boolean;
}
