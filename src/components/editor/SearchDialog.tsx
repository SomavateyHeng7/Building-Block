"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useDiagramStore } from "@/lib/diagram/store";
import { highlightWords, prepareSearch, searchDiagram, searchWords, type SearchResult } from "@/lib/diagram/search";
import { goTo } from "./canvasFocus";
import { Icon } from "./Icon";

const LIMIT = 50;

/** A result's text with the query's words marked. */
function Highlight({ text, words }: { text: string; words: string[] }) {
  return highlightWords(text, words).map((part, index) =>
    part.mark ? (
      <mark key={index} className="rounded-sm bg-amber-200/70 text-inherit dark:bg-amber-400/30">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

const KIND_LABEL: Record<SearchResult["kind"], string> = {
  container: "Container",
  component: "Component",
  connection: "Connection",
  participant: "Participant",
  message: "Message",
  note: "Note",
};

/**
 * Find anything in the diagram (Ctrl/⌘+F): every tab and internal design. Arrow keys move through the
 * results; Enter or a click opens the tab it's on, selects it and zooms to it.
 */
export default function SearchDialog({ onClose }: { onClose: () => void }) {
  const diagram = useDiagramStore((state) => state.diagram);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const list = useRef<HTMLUListElement>(null);
  // On a big diagram a search takes longer than a frame, so the list catches up after typing rather than slowing it.
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => searchDiagram(diagram, deferredQuery, LIMIT), [diagram, deferredQuery]);
  const words = useMemo(() => searchWords(deferredQuery), [deferredQuery]);

  // Index while the dialog paints, before the first keystroke.
  useEffect(() => {
    const timer = setTimeout(() => prepareSearch(diagram));
    return () => clearTimeout(timer);
  }, [diagram]);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function open(result: SearchResult) {
    goTo({
      sectionId: result.sectionId,
      detailId: result.detailId,
      kind:
        result.kind === "connection" ? "edge"
        : result.kind === "participant" || result.kind === "message" || result.kind === "note" ? "sequence"
        : "node",
      id: result.id,
    });
    onClose();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") onClose();
    else if (event.key === "ArrowDown") setActive((index) => Math.min(index + 1, results.length - 1));
    else if (event.key === "ArrowUp") setActive((index) => Math.max(index - 1, 0));
    else if (event.key === "Enter") {
      // Enter pressed before the list caught up opens what matches what's typed now.
      const current = deferredQuery === query ? results : searchDiagram(diagram, query, LIMIT);
      if (current[active]) open(current[active]);
    }
    else return;
    event.preventDefault();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-3 pt-[12vh] sm:p-4 sm:pt-[12vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find in diagram"
        className="flex max-h-[70dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <Icon name="search" className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            autoFocus
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-label="Find components, containers, connections and sequence steps"
            placeholder="Find a component, technology, owner, protocol…"
            className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none placeholder:text-zinc-400 sm:text-sm"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="hidden rounded border border-zinc-300 px-1.5 font-mono text-[11px] text-zinc-500 pointer-fine:block dark:border-zinc-700">
            Esc
          </kbd>
        </div>
        {query.trim() && (
          <p className="sr-only" aria-live="polite">
            {results.length ? `${results.length} found` : "Nothing found"}
          </p>
        )}
        {results.length > 0 ? (
          <ul ref={list} id={listId} role="listbox" aria-label="Results" className="overflow-y-auto p-1.5">
            {results.map((result, index) => (
              <li
                key={`${result.kind}:${result.detailId ?? ""}:${result.id}`}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === active}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 ${
                  index === active ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
                onMouseMove={() => setActive(index)}
                onClick={() => open(result)}
              >
                <span className="flex items-baseline gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">
                    <Highlight text={result.label} words={words} />
                  </span>
                  <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">{KIND_LABEL[result.kind]}</span>
                </span>
                <span className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                  {result.where}
                  {result.match && (
                    <>
                      {" · "}
                      <Highlight text={result.match} words={words} />
                    </>
                  )}
                </span>
              </li>
            ))}
            {results.length === LIMIT && (
              <li role="presentation" className="px-3 py-2 text-xs text-zinc-500">
                Showing the first {LIMIT}. Add a word to narrow it down.
              </li>
            )}
          </ul>
        ) : (
          query.trim() && <p className="px-4 py-6 text-center text-sm text-zinc-500">Nothing matches “{query.trim()}”.</p>
        )}
      </div>
    </div>
  );
}
