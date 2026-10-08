"use client";

import { useEffect } from "react";

interface UnsavedChangesDialogProps {
  name: string;
  /** True when Save will ask where to put the file, so the button says so. */
  needsLocation: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/** Shown before anything that would replace the open diagram, which exists only in memory until saved. */
export default function UnsavedChangesDialog({ name, needsLocation, onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="unsaved-title" className="text-base font-semibold">
          Save changes to &ldquo;{name}&rdquo;?
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Building Block doesn&apos;t keep a copy. If you don&apos;t save to a file, these changes are lost.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
            onClick={onDiscard}
          >
            Don&apos;t save
          </button>
          <button
            type="button"
            autoFocus
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            onClick={onSave}
          >
            {needsLocation ? "Save as…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
