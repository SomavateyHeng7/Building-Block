"use client";

import { useEffect, useMemo, useRef } from "react";
import { useDiagramStore } from "@/lib/diagram/store";
import { HINT_ORDER, HINT_TITLES, diagramHints, type Hint } from "@/lib/diagram/hints";
import { goTo } from "./canvasFocus";
import { useDialogFocus } from "./useDialogFocus";

const SECTION_HEADING = "text-xs font-semibold uppercase tracking-wide text-zinc-500";

/**
 * Lists what is worth a second look before a diagram is shared: components nothing connects to, connections
 * without a protocol, components without an owner. Picking one opens it. Nothing here blocks saving or exporting.
 */
export default function HintsDialog({ onClose }: { onClose: () => void }) {
  const diagram = useDiagramStore((state) => state.diagram);
  const hints = useMemo(() => diagramHints(diagram), [diagram]);
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function show(hint: Hint) {
    onClose();
    goTo({ sectionId: hint.sectionId, detailId: hint.detailId, kind: hint.target === "edge" ? "edge" : "node", id: hint.id });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hints-title"
        className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 id="hints-title" className="text-base font-semibold">
            Check before you share
          </h2>
          <p className="mt-1 text-sm text-zinc-500" aria-live="polite">
            {hints.length ? `${hints.length} thing${hints.length === 1 ? "" : "s"} worth a look. None of them stops you saving or exporting.` : "Nothing to flag."}
          </p>
        </div>
        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          {hints.length === 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Every component is connected and has an owner, and every connection has a protocol.
            </p>
          )}
          {HINT_ORDER.map((kind) => {
            const group = hints.filter((hint) => hint.kind === kind);
            if (!group.length) return null;
            return (
              <section key={kind} className="flex flex-col gap-2">
                <h3 className={SECTION_HEADING}>
                  {HINT_TITLES[kind]} · {group.length}
                </h3>
                <ul className="flex flex-col gap-1">
                  {group.map((hint) => (
                    <li key={`${hint.kind}:${hint.id}`}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => show(hint)}
                      >
                        <span className="flex w-full items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate font-medium">{hint.label}</span>
                          <span className="shrink-0 text-xs text-zinc-500">{hint.where}</span>
                        </span>
                        {hint.kind === "open-comment" && <span className="line-clamp-2 text-xs text-zinc-500">{hint.message}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <div className="flex justify-end border-t border-zinc-200 bg-zinc-50 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-950/40">
          <button
            type="button"
            autoFocus
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
