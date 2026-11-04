// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CommentMarker } from "@/components/editor/nodes/CommentMarker";
import { useDetailsRequest } from "@/components/editor/detailsPanel";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { useDiagramStore } from "@/lib/diagram/store";

const store = () => useDiagramStore.getState();
let id: string;

beforeEach(() => {
  store().loadDiagram(createBlankDiagram());
  store().addBlock({ x: 0, y: 0 });
  id = store().diagram.sections[0].nodes[0].id;
  useDetailsRequest.setState({ request: null });
  store().setSelection([]);
});
afterEach(cleanup);

describe("CommentMarker", () => {
  it("shows nothing without open comments", () => {
    const { container } = render(<CommentMarker id={id} />);
    expect(container.firstChild).toBeNull();
    store().addComment(id, "Done", "Sam");
    store().setCommentResolved(store().diagram.comments![0].id, true);
    cleanup();
    expect(render(<CommentMarker id={id} />).container.firstChild).toBeNull();
  });

  it("counts the open comments and, when clicked, selects the item and asks for the comment field", () => {
    store().addComment(id, "One", "Sam");
    store().addComment(id, "Two", "Lee");
    render(<CommentMarker id={id} />);

    const badge = screen.getByRole("button", { name: "2 open comments. Show" });
    expect(badge.textContent).toBe("2");
    expect(badge.className).toContain("bb-comment-marker");

    fireEvent.click(badge);
    expect(store().selectedNodeIds).toEqual([id]);
    expect(useDetailsRequest.getState().request).toEqual({ focusId: "bb-comments-field" });
  });
});
