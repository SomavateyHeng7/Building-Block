import type { Diagram } from "@/lib/diagram/types";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  build: () => Diagram;
}
