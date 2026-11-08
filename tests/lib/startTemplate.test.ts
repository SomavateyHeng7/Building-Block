import { afterEach, describe, expect, it } from "vitest";
import { startFromTemplate } from "@/lib/startTemplate";
import { useCompareView } from "@/components/editor/compareView";
import { useDiagramStore } from "@/lib/diagram/store";
import { getTemplate } from "@/templates";
import { clearRecentTemplates, readRecentTemplates } from "@/lib/recentTemplates";

afterEach(() => {
  useCompareView.getState().hide();
  clearRecentTemplates();
});

describe("startFromTemplate", () => {
  it("opens the diagram and remembers the template", () => {
    startFromTemplate(getTemplate("three-tier")!);
    expect(useDiagramStore.getState().diagram.name).toBe("Three-tier Web Application");
    expect(readRecentTemplates()).toEqual(["three-tier"]);
    expect(useCompareView.getState().pair).toBeNull();
  });

  it("opens the migration roadmap with Current and Target marked for comparison", () => {
    startFromTemplate(getTemplate("migration-roadmap")!);
    const { diagram } = useDiagramStore.getState();
    const pair = useCompareView.getState().pair;
    expect(pair?.diagramId).toBe(diagram.id);
    expect(diagram.sections.find((section) => section.id === pair?.fromId)?.name).toBe("Current");
    expect(diagram.sections.find((section) => section.id === pair?.toId)?.name).toBe("Target");
    expect(diagram.activeSectionId).toBe(diagram.sections[0].id);
  });

  it("leaves no comparison applying to the next template's diagram", () => {
    startFromTemplate(getTemplate("migration-roadmap")!);
    startFromTemplate(getTemplate("serverless")!);
    const { diagram } = useDiagramStore.getState();
    expect(useCompareView.getState().pair?.diagramId).not.toBe(diagram.id);
  });
});
