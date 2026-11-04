import { beforeEach, describe, expect, it } from "vitest";
import { commentTargets, mergeComments } from "@/lib/diagram/comments";
import { createBlankDiagram } from "@/lib/diagram/factory";
import { diagramHints } from "@/lib/diagram/hints";
import { useDiagramStore } from "@/lib/diagram/store";
import { parseDiagram } from "@/lib/diagram/validate";
import type { Diagram, DiagramNode, ReviewComment } from "@/lib/diagram/types";

const block = (id: string, label: string): DiagramNode => ({
  id,
  type: "block",
  position: { x: 0, y: 0 },
  size: { width: 100, height: 50 },
  data: { kind: "block", label, containerId: null, owner: "Team" },
});

function diagramWithTwoBlocks(): Diagram {
  const diagram = createBlankDiagram();
  diagram.sections[0] = {
    ...diagram.sections[0],
    nodes: [block("a", "Web"), block("b", "API")],
    edges: [{ id: "e", source: "a", target: "b", protocol: "REST" }],
  };
  return diagram;
}

const comment = (id: string, targetId: string, extra: Partial<ReviewComment> = {}): ReviewComment => ({
  id,
  targetId,
  author: "Sam",
  text: "Why REST?",
  createdAt: "2026-10-29T10:00:00.000Z",
  ...extra,
});

describe("merging comments", () => {
  const targets = new Set(["a", "b", "e"]);

  it("adds new comments, once", () => {
    const first = mergeComments([comment("1", "a")], [comment("1", "a"), comment("2", "e")], targets);
    expect(first).toMatchObject({ added: 1, resolved: 0, skipped: 0 });
    expect(first.comments.map((c) => c.id)).toEqual(["1", "2"]);
    expect(mergeComments(first.comments, [comment("2", "e")], targets).added).toBe(0);
  });

  it("carries over a resolution but never reopens or deletes", () => {
    const merged = mergeComments([comment("1", "a"), comment("2", "b", { resolved: true })], [comment("1", "a", { resolved: true }), comment("2", "b")], targets);
    expect(merged.resolved).toBe(1);
    expect(merged.comments.map((c) => !!c.resolved)).toEqual([true, true]);
    expect(mergeComments(merged.comments, [], targets).comments).toHaveLength(2);
  });

  it("skips comments about something that isn't here", () => {
    expect(mergeComments(undefined, [comment("1", "zzz")], targets)).toMatchObject({ added: 0, skipped: 1, comments: [] });
  });
});

describe("comments in the store", () => {
  beforeEach(() => useDiagramStore.getState().loadDiagram(diagramWithTwoBlocks()));
  const store = () => useDiagramStore.getState();

  it("adds, resolves, reopens and deletes, each as an undo step", () => {
    const added = store().addComment("a", "  Is this still needed?  ", "  Sam ")!;
    expect(added).toMatchObject({ targetId: "a", text: "Is this still needed?", author: "Sam" });
    store().setCommentResolved(added.id, true);
    expect(store().diagram.comments![0].resolved).toBe(true);
    store().setCommentResolved(added.id, false);
    expect("resolved" in store().diagram.comments![0]).toBe(false);
    store().deleteComment(added.id);
    expect(store().diagram.comments).toBeUndefined();
    store().undo();
    expect(store().diagram.comments).toHaveLength(1);
  });

  it("refuses empty comments and comments about nothing", () => {
    expect(store().addComment("a", "   ", "Sam")).toBeNull();
    expect(store().addComment("nope", "Hello", "Sam")).toBeNull();
    expect(store().diagram.comments).toBeUndefined();
  });

  it("can be about a connection, and merging brings in another copy's comments", () => {
    expect(store().addComment("e", "Needs a retry policy", "")).toMatchObject({ author: "Reviewer" });
    const result = store().mergeComments([comment("x", "b")]);
    expect(result.added).toBe(1);
    expect(store().diagram.comments).toHaveLength(2);
    expect(store().mergeComments([comment("x", "b")]).added).toBe(0);
  });
});

describe("comments in a file", () => {
  it("round-trips, and drops empty, repeated and orphaned ones with a note", () => {
    const diagram = { ...diagramWithTwoBlocks(), comments: [comment("1", "a"), comment("1", "b"), comment("2", "gone"), comment("3", "e", { text: "  " }), comment("4", "b", { resolved: true })] };
    const parsed = parseDiagram(JSON.parse(JSON.stringify(diagram)));
    expect(parsed.diagram.comments!.map((c) => c.id)).toEqual(["1", "4"]);
    expect(parsed.diagram.comments![1].resolved).toBe(true);
    expect(parsed.fixes.join(" ")).toMatch(/Left out 3 review comments/);
    expect(commentTargets(parsed.diagram).has("e")).toBe(true);
  });
});

describe("open comments in the check list", () => {
  it("lists unresolved comments with who wrote what", () => {
    const diagram = { ...diagramWithTwoBlocks(), comments: [comment("1", "a"), comment("2", "e", { resolved: true })] };
    const hints = diagramHints(diagram).filter((hint) => hint.kind === "open-comment");
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ id: "a", target: "node", label: "Web", message: "Sam: Why REST?" });
  });
});
