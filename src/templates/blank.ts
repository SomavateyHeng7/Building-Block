import { createBlankDiagram } from "@/lib/diagram/factory";
import type { TemplateDefinition } from "./types";

export const blankTemplate: TemplateDefinition = {
  id: "blank",
  name: "Blank canvas",
  description: "Start from an empty canvas with just the default color legend.",
  category: "Basics",
  build: () => createBlankDiagram("Untitled Diagram"),
};
