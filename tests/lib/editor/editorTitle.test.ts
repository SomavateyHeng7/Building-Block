import { describe, expect, it } from "vitest";
import { EDITOR_TITLE, editorTitle } from "@/lib/editor/editorTitle";

describe("editor tab title", () => {
  it("names the diagram, with a dot while there are unsaved changes", () => {
    expect(editorTitle("Payments landscape", false)).toBe("Payments landscape · Building Block");
    expect(editorTitle("Payments landscape", true)).toBe("• Payments landscape · Building Block");
  });

  it("falls back to the editor's title for a diagram without a name", () => {
    expect(editorTitle("   ", false)).toBe(EDITOR_TITLE);
    expect(editorTitle("", true)).toBe(`• ${EDITOR_TITLE}`);
  });
});
