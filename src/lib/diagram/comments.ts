import type { Diagram, ReviewComment } from "./types";

/**
 * Review comments live in the diagram file, so they travel with it: a reviewer adds theirs to their copy and sends
 * the file back, and the author merges them in. There is no server and no account, so a comment's author is just the
 * name typed. A comment belongs to a component, container or connection by its id.
 */

export const MAX_COMMENTS = 5_000;

/** Ids of everything a comment can be about, on every tab and internal design. */
export function commentTargets(diagram: Pick<Diagram, "sections">): Set<string> {
  const ids = new Set<string>();
  for (const section of diagram.sections) {
    for (const edge of section.edges ?? []) ids.add(edge.id);
    for (const node of section.nodes) {
      ids.add(node.id);
      if (node.data.kind !== "block" || !node.data.detail) continue;
      for (const inner of node.data.detail.nodes) ids.add(inner.id);
      for (const edge of node.data.detail.edges ?? []) ids.add(edge.id);
    }
  }
  return ids;
}

export function commentsOn(comments: ReviewComment[] | undefined, targetId: string): ReviewComment[] {
  return (comments ?? []).filter((comment) => comment.targetId === targetId);
}

export function openCommentCount(comments: ReviewComment[] | undefined, targetId: string): number {
  return commentsOn(comments, targetId).filter((comment) => !comment.resolved).length;
}

export interface MergeResult {
  comments: ReviewComment[];
  added: number;
  /** Comments already here that the other copy had resolved. */
  resolved: number;
  /** Comments about something that isn't in this diagram (it was deleted, or the file is a different diagram). */
  skipped: number;
}

/**
 * Brings the comments from another copy of the diagram into this one. A comment is recognised by its id, so merging
 * the same file twice adds nothing. Anything a reviewer resolved stays resolved, but a comment is never reopened,
 * and nothing is deleted.
 */
export function mergeComments(current: ReviewComment[] | undefined, incoming: ReviewComment[], targets: Set<string>): MergeResult {
  const comments = [...(current ?? [])];
  const byId = new Map(comments.map((comment, index) => [comment.id, index]));
  let added = 0;
  let resolved = 0;
  let skipped = 0;
  for (const comment of incoming) {
    const at = byId.get(comment.id);
    if (at !== undefined) {
      if (comment.resolved && !comments[at].resolved) {
        comments[at] = { ...comments[at], resolved: true };
        resolved += 1;
      }
      continue;
    }
    if (!targets.has(comment.targetId) || comments.length >= MAX_COMMENTS) {
      skipped += 1;
      continue;
    }
    byId.set(comment.id, comments.length);
    comments.push(comment);
    added += 1;
  }
  return { comments, added, resolved, skipped };
}
