"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useDiagramStore } from "@/lib/diagram/store";
import { downloadDiagramJson, hasContent } from "@/lib/diagram/file";

/**
 * The editor crashed. The diagram is still in memory (the store lives outside React),
 * so offer it as a download, and a retry that first undoes the change that may have caused it.
 */
export default function EditorError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const diagram = useDiagramStore((state) => state.diagram);
  const canUndo = useDiagramStore((state) => state.past.length > 0);
  const undo = useDiagramStore((state) => state.undo);
  const recoverable = hasContent(diagram);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const primary =
    "rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
  const secondary =
    "rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900";

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-zinc-50 p-6 text-center dark:bg-zinc-950">
      <h1 className="text-xl font-semibold">The editor ran into a problem</h1>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        {recoverable
          ? "Your diagram is still here. Download it as a JSON file first so nothing is lost, then try again. Nothing is kept in this browser, so a download is the only way to keep it."
          : "Try again, or go back to the start page."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {recoverable && (
          <button type="button" className={primary} onClick={() => downloadDiagramJson(diagram)}>
            Download diagram (JSON)
          </button>
        )}
        {canUndo && (
          <button
            type="button"
            className={secondary}
            onClick={() => {
              undo();
              retry();
            }}
          >
            Undo last change and try again
          </button>
        )}
        <button type="button" className={secondary} onClick={() => retry()}>
          Try again
        </button>
        <Link href="/diagrams" className={secondary}>
          Start page
        </Link>
      </div>
    </div>
  );
}
