"use client";

import { useEffect, useRef, useState } from "react";
import { IMPORT_EXTENSIONS, ImportError, importDiagramText, type ImportResult } from "@/lib/diagram/importFile";
import type { LegendEntry } from "@/lib/diagram/types";

const SECONDARY =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
const PRIMARY =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

const EXAMPLE = `sequenceDiagram
  actor Customer
  Customer->>Web Shop: Place order
  Web Shop->>Orders: Create order
  Orders-->>Web Shop: Order number`;

/**
 * Brings in a draw.io file (architecture tabs) or Mermaid sequence text (a sequence tab), from a file or
 * pasted. `legend` is the open diagram's, so imported colours can reuse its imported categories; `action`
 * says where the result goes ("Open" for a new diagram, "Add tabs" for the open one).
 */
export default function ImportDialog({
  legend,
  action,
  onImport,
  onClose,
}: {
  legend?: LegendEntry[];
  action: string;
  onImport: (result: ImportResult) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function run(source: string, fileName?: string) {
    setBusy(true);
    setError(null);
    try {
      onImport(await importDiagramText(source, fileName, legend));
    } catch (problem) {
      setError(problem instanceof ImportError ? problem.message : "That couldn't be imported. Check it's a draw.io file or Mermaid sequence diagram.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <h2 id="import-title" className="text-base font-semibold">
            Import from draw.io or Mermaid
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            A <strong className="font-medium text-zinc-700 dark:text-zinc-300">draw.io</strong> file becomes architecture tabs, one per page,
            keeping positions, containers, colours and arrows. A <strong className="font-medium text-zinc-700 dark:text-zinc-300">Mermaid sequence diagram</strong>{" "}
            becomes a sequence tab. Nothing leaves your device.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <input
            ref={input}
            type="file"
            accept={IMPORT_EXTENSIONS.join(",")}
            className="sr-only"
            aria-label="Choose a file to import"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) await run(await file.text(), file.name);
            }}
          />
          <button type="button" autoFocus disabled={busy} className={`${PRIMARY} self-start`} onClick={() => input.current?.click()}>
            Choose a file…
          </button>
          <span className="text-xs text-zinc-500">.drawio or .xml from draw.io (not .svg or .png); .mmd or .md with a Mermaid block</span>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Or paste Mermaid or draw.io text
          <textarea
            rows={7}
            spellCheck={false}
            placeholder={EXAMPLE}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs font-normal outline-none placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY} onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={busy || !text.trim()} className={PRIMARY} onClick={() => run(text)}>
            {busy ? "Importing…" : action}
          </button>
        </div>
      </div>
    </div>
  );
}

/** What to tell the user after an import: what came in, and anything that was simplified. */
export function describeImport(result: ImportResult): { title: string; details: string[] } {
  const tabs = result.sections.length;
  return {
    title: `Imported ${tabs === 1 ? `"${result.sections[0].name}"` : `${tabs} tabs`}`,
    details: result.fixes,
  };
}
