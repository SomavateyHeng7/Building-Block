// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CommentsSection from "@/components/editor/CommentsSection";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { useDiagramStore } from "@/lib/diagram/store";

const store = () => useDiagramStore.getState();
let blockId: string;

beforeEach(() => {
  window.localStorage.clear();
  store().loadDiagram(createBlankDiagram());
  store().addBlock({ x: 0, y: 0 });
  blockId = store().diagram.sections[0].nodes[0].id;
});
afterEach(cleanup);

describe("CommentsSection", () => {
  it("adds a comment under the name given, and remembers the name", () => {
    render(<CommentsSection targetId={blockId} />);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("New comment"), { target: { value: "Why this vendor?" } });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

    expect(store().diagram.comments).toMatchObject([{ targetId: blockId, author: "Sam", text: "Why this vendor?" }]);
    expect(screen.getByText("Why this vendor?")).toBeTruthy();
    expect(window.localStorage.getItem("bb:author")).toBe("Sam");
  });

  it("won't add an empty comment", () => {
    render(<CommentsSection targetId={blockId} />);
    expect((screen.getByRole("button", { name: "Add comment" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("resolves, reopens and deletes", () => {
    store().addComment(blockId, "Needs an owner", "Sam");
    render(<CommentsSection targetId={blockId} />);
    expect(screen.getByText(/1 open of 1/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    expect(screen.getByText(/0 open of 1/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    expect(screen.getByText(/1 open of 1/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(store().diagram.comments).toBeUndefined();
  });
});
