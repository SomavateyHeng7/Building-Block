import { describe, expect, it } from "vitest";
import { filterTemplates, templates, TEMPLATE_CATEGORIES } from "@/templates";

const ids = (list: typeof templates) => list.map((template) => template.id);

describe("template search and categories", () => {
  it("shows everything with no search, in order", () => {
    expect(ids(filterTemplates(templates, ""))).toEqual(ids(templates));
    expect(ids(filterTemplates(templates, "   ", "All"))).toEqual(ids(templates));
  });

  it("finds by name, description or keyword, in any order, ignoring case and accents", () => {
    expect(ids(filterTemplates(templates, "SWIMLANE"))).toContain("cross-functional");
    expect(ids(filterTemplates(templates, "roadmap migration"))).toEqual(["migration-roadmap"]);
    expect(ids(filterTemplates(templates, "lané"))).toContain("cross-functional");
    expect(ids(filterTemplates(templates, "vpc"))).toEqual(["cloud-landing-zone"]);
  });

  it("needs every word to match", () => {
    expect(filterTemplates(templates, "swimlane kubernetes")).toEqual([]);
  });

  it("limits to a category, together with the search", () => {
    const planning = filterTemplates(templates, "", "Planning");
    expect(ids(planning).sort()).toEqual(["current-vs-target", "migration-roadmap"]);
    expect(ids(filterTemplates(templates, "roadmap", "Architecture"))).toEqual([]);
  });

  it("gives every template a known category, and every category at least one template", () => {
    for (const template of templates) expect(TEMPLATE_CATEGORIES).toContain(template.category);
    for (const category of TEMPLATE_CATEGORIES) expect(filterTemplates(templates, "", category).length).toBeGreaterThan(0);
  });
});
