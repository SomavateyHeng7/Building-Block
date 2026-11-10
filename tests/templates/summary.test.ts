import { describe, expect, it } from "vitest";
import { allTemplates, describeSummary, describeTemplate, getTemplate } from "@/templates";

describe("describeTemplate", () => {
  it("counts tabs and the components on the first tab", () => {
    expect(describeTemplate(getTemplate("three-tier")!)).toBe("1 tab · 9 components");
    expect(describeTemplate(getTemplate("migration-roadmap")!)).toBe("3 tabs: Current, Transition, Target · 3 to 6 components each");
  });

  it("counts participants on a sequence, and says nothing for the blank template", () => {
    expect(describeTemplate(getTemplate("sequence")!)).toBe("1 tab · 5 participants");
    expect(describeTemplate(getTemplate("blank")!)).toBe("");
  });

  it("gives every other template a summary", () => {
    for (const template of allTemplates.filter((candidate) => candidate.id !== "blank")) {
      expect(describeTemplate(template)).toMatch(/^(1 tab · \d+ (components?|participants?)|\d+ tabs: .+ · (\d+|\d+ to \d+) (components|participants) each)$/);
    }
  });
});

describe("compare", () => {
  it("only names tabs the template really has", () => {
    for (const template of allTemplates.filter((candidate) => candidate.compare)) {
      const names = template.build().sections.map((section) => section.name);
      expect(names).toContain(template.compare!.from);
      expect(names).toContain(template.compare!.to);
    }
  });

  it("is set on the migration roadmap", () => {
    expect(getTemplate("migration-roadmap")?.compare).toEqual({ from: "Current", to: "Target" });
  });
});

describe("describeSummary", () => {
  it("lists the tabs and the range of sizes for several tabs, and says nothing for an empty one", () => {
    expect(describeSummary({ tabs: ["A", "B"], parts: [4, 4], partName: "component" })).toBe("2 tabs: A, B · 4 components each");
    expect(describeSummary({ tabs: ["A", "B"], parts: [2, 5], partName: "component" })).toBe("2 tabs: A, B · 2 to 5 components each");
    expect(describeSummary({ tabs: ["A"], parts: [1], partName: "component" })).toBe("1 tab · 1 component");
    expect(describeSummary({ tabs: ["A"], parts: [0], partName: "component" })).toBe("");
  });
});
