"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { create } from "zustand";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { applySequenceCode, readSequenceCode, toMermaidSequence } from "@/lib/diagram/exportMermaid";
import { ImportError } from "@/lib/diagram/importMermaid";
import { downloadBlob, fileBaseName } from "@/lib/diagram/file";
import { toast } from "@/lib/toast";
import { Icon } from "./Icon";
import { useReadOnly } from "./viewMode";

/** Whether the Mermaid code is shown beside sequence tabs (screen state, not saved). */
export const useSequenceCode = create<{ open: boolean; toggle: () => void; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  toggle: () => set((state) => ({ open: !state.open })),
  setOpen: (open) => set({ open }),
}));

const BUTTON =
  "inline-flex min-h-0 items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900";

const EMPTY = { participants: [], steps: [] };

/**
 * The open sequence tab as Mermaid code, kept in step with the sheet. Editing the code and pressing Apply (or
 * Ctrl/⌘+Enter) replaces the sequence, as one undo step; participants keep their colour, description and link to
 * a component when their name is unchanged. While there are unapplied edits, the code stops following the sheet.
 */
export default function SequenceCode() {
  const view = useDiagramStore((state) => getActiveSection(state.diagram));
  const updateSequence = useDiagramStore((state) => state.updateSequence);
  const setOpen = useSequenceCode((state) => state.setOpen);
  const readOnly = useReadOnly();
  const sequence = view.sequence ?? EMPTY;
  const generated = useMemo(() => toMermaidSequence(sequence), [sequence]);
  // Edits per tab, so switching tabs doesn't carry one tab's draft into another.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ tab: string; message: string } | null>(null);
  const fieldId = useId();
  const draft = drafts[view.id];
  const dirty = draft !== undefined && draft !== generated;
  const code = draft ?? generated;
  const shownError = error?.tab === view.id ? error.message : null;

  function setDraft(value: string | undefined) {
    setDrafts((current) => {
      const next = { ...current };
      if (value === undefined) delete next[view.id];
      else next[view.id] = value;
      return next;
    });
  }

  function apply() {
    if (!dirty || readOnly) return;
    try {
      const parsed = readSequenceCode(code);
      updateSequence((current) => applySequenceCode(current, parsed));
      setDraft(undefined);
      setError(null);
      if (parsed.fixes.length) toast.info("Applied the code, with changes", { description: parsed.fixes.join(" ") });
    } catch (caught) {
      if (!(caught instanceof ImportError)) throw caught;
      setError({ tab: view.id, message: caught.message });
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      apply();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Copied the Mermaid code");
    } catch {
      toast.error("Couldn't copy", { description: "Select the code and copy it with Ctrl/⌘+C instead." });
    }
  }

  function download() {
    const name = `${fileBaseName(view.name)}.mmd`;
    // The file carries the tab's name as its title, like the files the import reads.
    downloadBlob(new Blob([toMermaidSequence(sequence, view.name)], { type: "text/plain" }), name);
    toast.success(`Downloaded ${name}`);
  }

  return (
    <section
      aria-labelledby={`${fieldId}-title`}
      className="flex min-h-0 shrink-0 flex-col border-t border-zinc-200 bg-white max-lg:h-[45%] lg:w-96 lg:border-l lg:border-t-0 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <h2 id={`${fieldId}-title`} className="flex flex-1 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <Icon name="code" className="h-3.5 w-3.5" />
          Mermaid code
        </h2>
        <button type="button" className={BUTTON} onClick={copy}>
          <Icon name="copy" className="h-3.5 w-3.5" />
          Copy
        </button>
        <button type="button" className={BUTTON} onClick={download} disabled={!sequence.participants.length}>
          <Icon name="download" className="h-3.5 w-3.5" />
          .mmd
          <span className="sr-only"> (download)</span>
        </button>
        <button type="button" aria-label="Close the code" title="Close the code" className={`${BUTTON} px-1.5`} onClick={() => setOpen(false)}>
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>
      <label htmlFor={fieldId} className="sr-only">
        Mermaid code for {view.name}
      </label>
      <textarea
        id={fieldId}
        value={code}
        readOnly={readOnly}
        spellCheck={false}
        // Code reads line by line: long lines scroll sideways instead of wrapping into what look like new lines.
        wrap="off"
        autoCapitalize="off"
        autoCorrect="off"
        aria-invalid={!!shownError}
        aria-describedby={`${fieldId}-help`}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={handleKeyDown}
        className="min-h-0 flex-1 resize-none overflow-auto whitespace-pre bg-transparent p-3 font-mono text-[13px] leading-relaxed text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40 dark:text-zinc-200"
      />
      <div id={`${fieldId}-help`} className="flex flex-col gap-2 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        {shownError && (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {shownError}
          </p>
        )}
        {readOnly ? (
          <p>Switch to Edit to change the code.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-0 items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              disabled={!dirty}
              onClick={apply}
            >
              <Icon name="check" className="h-3.5 w-3.5" />
              Apply
            </button>
            <button type="button" className={BUTTON} disabled={!dirty} onClick={() => (setDraft(undefined), setError(null))}>
              Undo edits
            </button>
            <span>{dirty ? "Ctrl/⌘+Enter applies. The sheet won't change until you do." : "Follows the sheet as you edit it."}</span>
          </div>
        )}
      </div>
    </section>
  );
}
