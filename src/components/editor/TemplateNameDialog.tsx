"use client";

import { useState } from "react";

/** Asks for a template name in the app instead of a browser prompt. */
export default function TemplateNameDialog({
  initialName,
  onSave,
  onCancel,
}: {
  initialName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Save as template"
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && onCancel()}
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) onSave(trimmed);
        }}
      >
        <h2 className="text-base font-semibold">Save as template</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Reuses this diagram&apos;s layout and legend as a starting point. Stored in this browser only.
        </p>
        <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          Template name
          <input
            autoFocus
            onFocus={(event) => event.target.select()}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm font-normal outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!trimmed}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Save template
          </button>
        </div>
      </form>
    </div>
  );
}
