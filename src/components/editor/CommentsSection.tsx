"use client";

import { useMemo, useState } from "react";
import { commentsOn } from "@/lib/diagram/comments";
import { useDiagramStore } from "@/lib/diagram/store";
import { COMMENTS_FIELD_ID } from "./nodes/CommentMarker";
import { useReadOnly } from "./viewMode";

const AUTHOR_KEY = "bb:author";
const FIELD =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-normal outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900";
const LINK_BUTTON = "text-xs font-medium text-blue-600 hover:underline dark:text-blue-400";

/** The name used last time, kept in this browser only so people don't retype it; never part of a diagram. */
function rememberedAuthor(): string {
  try {
    return window.localStorage.getItem(AUTHOR_KEY) ?? "";
  } catch {
    return "";
  }
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Review comments on a component, container or connection. They are saved in the diagram file; a reviewer adds
 * theirs to a copy and the author merges it back with File → Merge comments from a file.
 */
export default function CommentsSection({ targetId }: { targetId: string }) {
  // Select the stored list and filter it here: a selector that builds a new array each time never settles.
  const allComments = useDiagramStore((state) => state.diagram.comments);
  const comments = useMemo(() => commentsOn(allComments, targetId), [allComments, targetId]);
  const addComment = useDiagramStore((state) => state.addComment);
  const setCommentResolved = useDiagramStore((state) => state.setCommentResolved);
  const deleteComment = useDiagramStore((state) => state.deleteComment);
  const readOnly = useReadOnly();
  const [author, setAuthor] = useState(rememberedAuthor);
  const [text, setText] = useState("");

  function add() {
    if (!addComment(targetId, text, author)) return;
    setText("");
    try {
      window.localStorage.setItem(AUTHOR_KEY, author.trim());
    } catch {
      // Remembering the name is a convenience; without storage it is typed again.
    }
  }

  if (readOnly && !comments.length) return null;
  const open = comments.filter((comment) => !comment.resolved).length;

  return (
    <section aria-label="Comments" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Comments
        {comments.length > 0 && <span className="ml-1.5 text-xs font-normal text-zinc-500">{open} open of {comments.length}</span>}
      </h3>
      {comments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={`rounded-md border p-2 text-sm ${comment.resolved ? "border-zinc-200 text-zinc-500 dark:border-zinc-800" : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30"}`}
            >
              <p className="text-xs text-zinc-500">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{comment.author}</span>
                {formatWhen(comment.createdAt) && ` · ${formatWhen(comment.createdAt)}`}
                {comment.resolved && " · Resolved"}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words">{comment.text}</p>
              {!readOnly && (
                <div className="mt-1.5 flex gap-3">
                  <button type="button" className={LINK_BUTTON} onClick={() => setCommentResolved(comment.id, !comment.resolved)}>
                    {comment.resolved ? "Reopen" : "Resolve"}
                  </button>
                  <button type="button" className={LINK_BUTTON} onClick={() => deleteComment(comment.id)}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="flex flex-col gap-1.5">
          <input
            aria-label="Your name"
            className={FIELD}
            placeholder="Your name"
            maxLength={80}
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
          />
          <textarea
            id={COMMENTS_FIELD_ID}
            aria-label="New comment"
            rows={2}
            className={`${FIELD} resize-y`}
            placeholder="Add a comment for the reviewers"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                add();
              }
            }}
          />
          <button
            type="button"
            disabled={!text.trim()}
            className="self-start rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={add}
          >
            Add comment
          </button>
        </div>
      )}
    </section>
  );
}
