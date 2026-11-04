"use client";

import { EdgeLabelRenderer } from "@xyflow/react";
import { openCommentCount } from "@/lib/diagram/comments";
import { useDiagramStore } from "@/lib/diagram/store";
import { showDetails } from "../detailsPanel";

export const COMMENTS_FIELD_ID = "bb-comments-field";

const BADGE =
  "bb-comment-marker nodrag nopan flex h-5 min-w-5 min-h-0 items-center justify-center gap-0.5 rounded-full border-2 border-white bg-blue-600 px-1 text-[10px] font-semibold leading-none text-white shadow-sm transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-zinc-900";

function openComments(id: string, edge: boolean) {
  const store = useDiagramStore.getState();
  if (edge) store.setSelectedEdge(id);
  else store.setSelection([id]);
  // Opens the details panel if it is a closed drawer or collapsed, then puts the cursor in the new comment.
  showDetails(COMMENTS_FIELD_ID);
}

function label(count: number) {
  return `${count} open comment${count === 1 ? "" : "s"}. Show`;
}

/**
 * A badge with the number of open review comments on a component or container, at its top-left corner. Left out of
 * exported pictures (see `keepInPicture`).
 */
export function CommentMarker({ id }: { id: string }) {
  const count = useDiagramStore((state) => openCommentCount(state.diagram.comments, id));
  if (!count) return null;
  return (
    <button
      type="button"
      aria-label={label(count)}
      title={label(count)}
      onClick={(event) => {
        event.stopPropagation();
        openComments(id, false);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className={`${BADGE} absolute -left-2 -top-2`}
    >
      {count}
    </button>
  );
}

/** The same for a connection, beside the middle of the line. */
export function EdgeCommentMarker({ id, x, y }: { id: string; x: number; y: number }) {
  const count = useDiagramStore((state) => openCommentCount(state.diagram.comments, id));
  if (!count) return null;
  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        aria-label={label(count)}
        title={label(count)}
        onClick={(event) => {
          event.stopPropagation();
          openComments(id, true);
        }}
        className={`${BADGE} absolute`}
        style={{ transform: `translate(-50%, -50%) translate(${x + 16}px, ${y - 14}px)`, pointerEvents: "all" }}
      >
        {count}
      </button>
    </EdgeLabelRenderer>
  );
}
