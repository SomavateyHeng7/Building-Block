"use client";

import { useEffect, useRef } from "react";
import { resolveDelete, useDeletePrompt } from "./deletePrompt";
import { useDialogFocus } from "./useDialogFocus";

const SECONDARY =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
const PRIMARY =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

/** Asks what happens to a container's components when the container is deleted. Keeping them is the default. */
export default function DeleteContainerDialog() {
  const pending = useDeletePrompt((state) => state.pending);

  useEffect(() => {
    if (!pending) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") resolveDelete("cancel");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pending]);

  return pending ? <Prompt pending={pending} /> : null;
}

/** Mounted only while asking, so focus returns to what was focused when it closes. */
function Prompt({ pending }: { pending: NonNullable<ReturnType<typeof useDeletePrompt.getState>["pending"]> }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const { containers, contents } = pending;
  const components = `${contents} component${contents === 1 ? "" : "s"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => resolveDelete("cancel")}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-container-title"
        aria-describedby="delete-container-body"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-container-title" className="text-base font-semibold">
          {containers.length === 1 ? <>Delete &ldquo;{containers[0]}&rdquo;?</> : <>Delete {containers.length} containers?</>}
        </h2>
        <p id="delete-container-body" className="mt-1 text-sm text-zinc-500">
          {containers.length === 1 ? "It holds" : "They hold"} {components}. Keep them on the canvas where they are, or
          delete them along with {containers.length === 1 ? "the container" : "the containers"}.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={SECONDARY} onClick={() => resolveDelete("cancel")}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
            onClick={() => resolveDelete("all")}
          >
            Delete everything
          </button>
          <button type="button" autoFocus className={PRIMARY} onClick={() => resolveDelete("keep")}>
            Keep components
          </button>
        </div>
      </div>
    </div>
  );
}
