"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useDialogFocus } from "../shared/useDialogFocus";
import { Icon } from "../shared/Icon";

export interface PaletteCommand {
  id: string;
  label: string;
  /** Where it lives, shown beside the name ("File", "Tab", "View"…) and matched when searching. */
  group: string;
  /** The keyboard shortcut, if it has one. */
  keys?: string;
  /** Extra words that find it ("png" finds Copy as image). */
  words?: string;
  run: () => void;
  /**
   * Run while the key press that chose it is still current, before the palette closes. Browsers only allow the
   * clipboard straight from a click or key press. Everything else waits for the palette to be gone, so the
   * dialog it opens keeps keyboard focus.
   */
  immediate?: boolean;
}

/** The commands that match what was typed, best first: names that start with it, then the others in list order. */
export function matchCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return commands;
  const scored: { command: PaletteCommand; score: number }[] = [];
  for (const command of commands) {
    const label = command.label.toLowerCase();
    const haystack = `${label} ${command.group.toLowerCase()} ${(command.words ?? "").toLowerCase()}`;
    if (!words.every((word) => haystack.includes(word))) continue;
    scored.push({ command, score: label.startsWith(words[0]) ? 0 : words.every((word) => label.includes(word)) ? 1 : 2 });
  }
  return scored.sort((a, b) => a.score - b.score).map((entry) => entry.command);
}

/**
 * Every action in one searchable list (Ctrl/⌘+K), for the ones that live in menus and panels. Arrow keys move,
 * Enter runs, Esc closes.
 */
export default function CommandPalette({ commands, onClose }: { commands: PaletteCommand[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => matchCommands(commands, query), [commands, query]);
  const current = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    list.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function choose(command: PaletteCommand) {
    if (command.immediate) {
      command.run();
      onClose();
    } else {
      onClose();
      setTimeout(command.run, 0);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") onClose();
    else if (event.key === "ArrowDown") setActive(Math.min(current + 1, results.length - 1));
    else if (event.key === "ArrowUp") setActive(Math.max(current - 1, 0));
    else if (event.key === "Enter") {
      if (results[current]) choose(results[current]);
    } else return;
    event.preventDefault();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-3 pt-[12vh] sm:p-4 sm:pt-[12vh]" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Commands"
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
            aria-activedescendant={results[current] ? `${listId}-${current}` : undefined}
            aria-label="Search commands"
            placeholder="Type a command: export, group, present, go to tab…"
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
        <p className="sr-only" aria-live="polite">
          {results.length ? `${results.length} commands` : "No command matches"}
        </p>
        {results.length > 0 ? (
          <ul ref={list} id={listId} role="listbox" aria-label="Commands" className="overflow-y-auto p-1.5">
            {results.map((command, index) => (
              <li
                key={command.id}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === current}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                  index === current ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(command)}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-medium">{command.label}</span>
                  <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">{command.group}</span>
                </span>
                {command.keys && (
                  <kbd className="hidden shrink-0 rounded border border-zinc-300 px-1.5 font-mono text-[11px] text-zinc-600 pointer-fine:block dark:border-zinc-700 dark:text-zinc-400">
                    {command.keys}
                  </kbd>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-zinc-500">No command matches “{query.trim()}”.</p>
        )}
      </div>
    </div>
  );
}
