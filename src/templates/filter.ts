import type { TemplateCategory, TemplateDefinition } from "./types";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Templates matching every word of the search (any order, accents and case ignored) in the name, description,
 * category or keywords, optionally limited to one category. Keeps the original order.
 */
export function filterTemplates(
  list: TemplateDefinition[],
  query: string,
  category: TemplateCategory | "All" = "All",
): TemplateDefinition[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return list.filter((template) => {
    if (category !== "All" && template.category !== category) return false;
    const haystack = normalize([template.name, template.description, template.category, ...(template.keywords ?? [])].join(" "));
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * The templates page's address for a search and category: `?category=Process&q=swimlane`, or "" for everything.
 * Kept in the address so a refresh, Back from the editor, or a shared link opens the page filtered the same way.
 */
export function templatesSearch(query: string, category: TemplateCategory | "All"): string {
  const params = new URLSearchParams();
  if (category !== "All") params.set("category", category);
  if (query.trim()) params.set("q", query);
  const search = params.toString();
  return search ? `?${search}` : "";
}
