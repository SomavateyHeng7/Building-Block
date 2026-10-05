"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  deleteDiagram,
  loadDiagramFromStorage,
  saveDiagram,
  getDiagramIndexServerSnapshot,
  getDiagramIndexSnapshot,
  subscribeDiagramIndex,
} from "@/lib/diagram/persistence";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Diagram } from "@/lib/diagram/types";
import { ImportDiagramButton } from "@/components/ImportDiagramButton";

export default function DiagramsPage() {
  const diagrams = useSyncExternalStore(
    subscribeDiagramIndex,
    getDiagramIndexSnapshot,
    getDiagramIndexServerSnapshot,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // The last deleted diagram is kept in memory briefly so the delete can be undone.
  const [undoable, setUndoable] = useState<Diagram | null>(null);

  useEffect(() => {
    if (!undoable) return;
    const timeout = setTimeout(() => setUndoable(null), 10000);
    return () => clearTimeout(timeout);
  }, [undoable]);

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          <Link href="/">Building Block</Link>
        </h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Drag containers and components onto a canvas to build architecture diagrams, then
          export them as PNG or PDF.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/editor/new"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Start blank
          </Link>
          <Link
            href="/templates"
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Browse templates
          </Link>
          <ImportDiagramButton
            label="Import file"
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          />
        </div>
      </div>

      {diagrams.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            My diagrams
          </h2>
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {diagrams.map((diagram) => (
              <li key={diagram.id} className="group relative">
                <Link
                  href={`/editor/${diagram.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {diagram.name}
                  </span>
                  <span className="pr-10 text-xs text-zinc-400">
                    {new Date(diagram.updatedAt).toLocaleString()}
                  </span>
                </Link>
                {pendingDeleteId === diagram.id ? (
                  <button
                    type="button"
                    autoFocus
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-red-600 px-2 py-0.5 text-xs text-white"
                    onClick={() => {
                      const full = loadDiagramFromStorage(diagram.id);
                      deleteDiagram(diagram.id);
                      setUndoable(full);
                      setPendingDeleteId(null);
                    }}
                    onBlur={() => setPendingDeleteId(null)}
                  >
                    Delete?
                  </button>
                ) : (
                  <button
                    type="button"
                    title="Delete diagram"
                    aria-label={`Delete ${diagram.name}`}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-1.5 text-zinc-400 opacity-0 [@media(hover:none)]:opacity-100 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                    onClick={() => setPendingDeleteId(diagram.id)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {undoable && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          <span>Deleted &ldquo;{undoable.name}&rdquo;</span>
          <button
            type="button"
            className="font-medium underline"
            onClick={() => {
              if (!saveDiagram(undoable)) window.alert("Couldn't restore it: browser storage is full or blocked.");
              setUndoable(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
