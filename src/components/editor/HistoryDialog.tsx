"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_CHECKPOINTS, nextCheckpointName, summarise } from "@/lib/diagram/checkpoints";
import { useDiagramStore } from "@/lib/diagram/store";
import { toast } from "@/lib/toast";
import { useDialogFocus } from "./useDialogFocus";
import CompareDialog from "./CompareDialog";
import type { Checkpoint } from "@/lib/diagram/checkpoints";

const FIELD =
  "min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900";
const LINK_BUTTON = "text-xs font-medium text-blue-600 hover:underline dark:text-blue-400";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Version history: named checkpoints saved inside the diagram file. Save one at a moment that matters (before a
 * review, after sign-off), look at an older one beside the current tabs, or go back to it. Restoring can be undone.
 */
export default function HistoryDialog({ onClose }: { onClose: () => void }) {
  const checkpoints = useDiagramStore((state) => state.diagram.checkpoints);
  const saveCheckpoint = useDiagramStore((state) => state.saveCheckpoint);
  const restoreCheckpoint = useDiagramStore((state) => state.restoreCheckpoint);
  const addCheckpointAsTabs = useDiagramStore((state) => state.addCheckpointAsTabs);
  const deleteCheckpoint = useDiagramStore((state) => state.deleteCheckpoint);
  const [name, setName] = useState("");
  const [restoring, setRestoring] = useState<string | null>(null);
  const [comparing, setComparing] = useState<Checkpoint | null>(null);
  const hasTabs = useDiagramStore((state) => state.diagram.sections.some((section) => section.kind !== "sequence"));
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const atLimit = (checkpoints?.length ?? 0) >= MAX_CHECKPOINTS;
  // Each checkpoint is a copy of the diagram in the file, so say how much it adds.
  const sizes = useMemo(() => new Map((checkpoints ?? []).map((checkpoint) => [checkpoint.id, JSON.stringify(checkpoint.snapshot).length])), [checkpoints]);
  const newestFirst = [...(checkpoints ?? [])].reverse();

  function save() {
    const saved = saveCheckpoint(name);
    if (!saved) return;
    setName("");
    toast.success(`Saved "${saved.name}"`, { description: "It's kept in the diagram file. Save the file to keep it." });
  }

  // The comparison takes this dialog's place, so only one dialog traps focus; closing it comes back here.
  if (comparing) return <CompareDialog checkpoint={comparing} onClose={() => setComparing(null)} onShown={onClose} />;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 id="history-title" className="text-base font-semibold">
            Version history
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Checkpoints are saved inside the diagram file, so they go wherever the file goes. Each one adds a copy of the diagram to the file (up to {MAX_CHECKPOINTS}).
          </p>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <input
              aria-label="Checkpoint name"
              className={FIELD}
              placeholder={nextCheckpointName(checkpoints)}
              maxLength={80}
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
            <button
              type="submit"
              disabled={atLimit}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Save checkpoint
            </button>
          </form>
          {atLimit && <p className="-mt-3 text-xs text-amber-700 dark:text-amber-400">That&apos;s {MAX_CHECKPOINTS} checkpoints. Delete one to save another.</p>}

          {newestFirst.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No checkpoints yet. Save one before a review or after sign-off, so you can come back to it.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {newestFirst.map((checkpoint) => (
                <li key={checkpoint.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{checkpoint.name}</span>
                    <span className="shrink-0 text-xs text-zinc-500">{formatWhen(checkpoint.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {summarise(checkpoint.snapshot)} · adds {formatSize(sizes.get(checkpoint.id) ?? 0)} to the file
                  </p>
                  {restoring === checkpoint.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-3" role="group" aria-label={`Restore ${checkpoint.name}`}>
                      <span className="text-xs">Replace the tabs and legend with this checkpoint? You can undo it.</span>
                      <button
                        type="button"
                        className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                        onClick={() => {
                          restoreCheckpoint(checkpoint.id);
                          toast.success(`Restored "${checkpoint.name}"`, { description: "Undo (Ctrl/⌘+Z) goes back to how it was." });
                          onClose();
                        }}
                      >
                        Restore
                      </button>
                      <button type="button" className={LINK_BUTTON} onClick={() => setRestoring(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-3">
                      {hasTabs && checkpoint.snapshot.sections.some((section) => section.kind !== "sequence") && (
                        <button type="button" className={LINK_BUTTON} onClick={() => setComparing(checkpoint)}>
                          What changed since
                        </button>
                      )}
                      <button type="button" className={LINK_BUTTON} onClick={() => setRestoring(checkpoint.id)}>
                        Restore…
                      </button>
                      <button
                        type="button"
                        className={LINK_BUTTON}
                        title="Add this checkpoint's tabs next to the current ones, then use Compare tabs"
                        onClick={() => {
                          addCheckpointAsTabs(checkpoint.id);
                          onClose();
                        }}
                      >
                        Open as tabs to compare
                      </button>
                      <button type="button" className={LINK_BUTTON} onClick={() => deleteCheckpoint(checkpoint.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-zinc-200 bg-zinc-50 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-950/40">
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
