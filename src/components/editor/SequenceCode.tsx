"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { create } from "zustand";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { applySequenceCode, mermaidLineOf, readSequenceCode, toMermaidSequence } from "@/lib/diagram/exportMermaid";
import { ImportError } from "@/lib/diagram/importMermaid";
import { downloadBlob, fileBaseName } from "@/lib/diagram/file";
import { checkSequenceCodeLines, limitNotice } from "@/lib/plans";
import { toast } from "@/lib/toast";
import { Icon } from "./Icon";
import PanelToggle from "./PanelToggle";
import { useReadOnly } from "./viewMode";

export const SEQUENCE_CODE_FIELD_ID = "bb-sequence-code";

/**
 * Asks the editor to show the code panel (expanded, or as a drawer), then puts the cursor in the code: at the end of
 * the line for `itemId` (a participant or step) when given, so a new message can be named straight away.
 */
export const useSequenceCode = create<{ request: number; itemId?: string; reveal: (itemId?: string) => void }>()((set) => ({
  request: 0,
  reveal: (itemId) => set((state) => ({ request: state.request + 1, itemId })),
}));

const BUTTON =
  "inline-flex min-h-0 items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900";

const EMPTY = { participants: [], steps: [] };

/** The Mermaid people need for a sequence, so nobody has to look it up: [code, what it does]. */
const SYNTAX: [string, string][] = [
  ["participant Shop as Web Shop", "A box; “as” sets the name shown"],
  ["actor User", "A person"],
  ["User->>Shop: Place order", "A call"],
  ["Shop-->>User: Order number", "A reply (dashed)"],
  ["Shop-)Mailer: Send email", "Async, no wait"],
  ["Shop->>Shop: Check stock", "A call to itself"],
  ["Note over Shop: Retries twice", "A note"],
  ["Shop->>Api: Get orders (REST)", "Protocol in brackets"],
];

/** The panel's width on wide screens, dragged by its right edge and remembered in this browser. */
const WIDTH_KEY = "bb:sequence-code-width";
// Wide enough for a typical "participant Id as Display name" line.
const DEFAULT_WIDTH = 460;
const MIN_WIDTH = 240;
/** Room the sheet keeps beside the panel. */
const SHEET_ROOM = 320;

function clampWidth(width: number) {
  const max = Math.max(MIN_WIDTH, (typeof window === "undefined" ? 1280 : window.innerWidth) - SHEET_ROOM);
  return Math.round(Math.min(max, Math.max(MIN_WIDTH, width)));
}

function readWidth() {
  try {
    const saved = Number(window.localStorage.getItem(WIDTH_KEY));
    return saved ? clampWidth(saved) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function saveWidth(width: number) {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(width));
  } catch {
    // The width just isn't remembered.
  }
}

/**
 * The left panel on sequence tabs: the open tab as Mermaid code, kept in step with the sheet. Editing the code and pressing Apply (or
 * Ctrl/⌘+Enter) replaces the sequence, as one undo step; participants keep their colour, description and link to
 * a component when their name is unchanged. While there are unapplied edits, the code stops following the sheet.
 */
export default function SequenceCode({ className = "", onCollapse }: { className?: string; onCollapse?: () => void }) {
  const view = useDiagramStore((state) => getActiveSection(state.diagram));
  const updateSequence = useDiagramStore((state) => state.updateSequence);
  const readOnly = useReadOnly();
  const sequence = view.sequence ?? EMPTY;
  const generated = useMemo(() => toMermaidSequence(sequence), [sequence]);
  // Edits per tab, so switching tabs doesn't carry one tab's draft into another.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ tab: string; message: string } | null>(null);
  const fieldId = SEQUENCE_CODE_FIELD_ID;
  const titleId = useId();
  const [width, setWidth] = useState(readWidth);
  // Whether the cheat sheet is open, per tab: open at first on a tab without steps yet.
  const [cheatSheet, setCheatSheet] = useState<Record<string, boolean>>({});
  const cheatOpen = cheatSheet[view.id] ?? !sequence.steps.length;
  // Settled when a tab is first shown (React's "adjust state while rendering"), so adding the first step doesn't
  // close it under you.
  if (cheatSheet[view.id] === undefined) setCheatSheet((current) => ({ ...current, [view.id]: cheatOpen }));
  const resize = useRef<{ startX: number; startWidth: number } | null>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  function resizeTo(next: number) {
    const clamped = clampWidth(next);
    setWidth(clamped);
    return clamped;
  }

  function handleResizeKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 64 : 16;
    const next =
      event.key === "ArrowLeft" ? width - step
      : event.key === "ArrowRight" ? width + step
      : event.key === "Home" ? MIN_WIDTH
      : event.key === "End" ? Infinity
      : null;
    if (next === null) return;
    event.preventDefault();
    saveWidth(resizeTo(next));
  }
  const draft = drafts[view.id];
  const dirty = draft !== undefined && draft !== generated;
  const code = draft ?? generated;
  const lineCount = code.split("\n").length;
  // Say how much of the plan's line limit is used once it's close, so hitting it later is no surprise.
  const limitCheck = checkSequenceCodeLines(code);
  const limitNote = limitNotice(limitCheck);
  const shownError = error?.tab === view.id ? error.message : null;

  // Asked to show the code: once the panel is on screen, focus it at the line asked for (or keep the cursor).
  const sequenceRef = useRef(sequence);
  useEffect(() => {
    sequenceRef.current = sequence;
  }, [sequence]);
  useEffect(
    () =>
      useSequenceCode.subscribe(({ itemId }) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const field = document.getElementById(SEQUENCE_CODE_FIELD_ID) as HTMLTextAreaElement | null;
            if (!field) return;
            field.focus();
            const line = itemId === undefined ? undefined : mermaidLineOf(sequenceRef.current, itemId);
            // Only while the code follows the sheet: with unapplied edits the lines may not match.
            if (line === undefined || field.value !== toMermaidSequence(sequenceRef.current)) return;
            const lines = field.value.split("\n");
            const end = lines.slice(0, line + 1).join("\n").length;
            field.setSelectionRange(end, end);
            // Bring the line into view: the line height is the same for every line.
            const lineHeight = parseFloat(getComputedStyle(field).lineHeight) || 20;
            field.scrollTop = Math.max(0, (line - 3) * lineHeight);
          }),
        );
      }),
    [],
  );

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
    // The plan's line limit; it only refuses once limits are enforced (see LIMITS_ENFORCED).
    const limit = checkSequenceCodeLines(code);
    if (limit.blocked) {
      setError({ tab: view.id, message: `The Free plan allows ${limit.limit} lines of code in a sequence tab; this has ${limit.used}.` });
      return;
    }
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
    <aside
      aria-labelledby={titleId}
      style={{ "--bb-code-width": `${width}px` } as CSSProperties}
      className={`min-h-0 flex-col border-r border-zinc-200 bg-white lg:w-[var(--bb-code-width)] dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      {/* Drag the right edge to resize; arrow keys too. Double-click goes back to the usual width. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the Mermaid code"
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        tabIndex={0}
        title="Drag to resize"
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-none transition-colors hover:bg-blue-500/30 focus-visible:bg-blue-500/40 active:bg-blue-500/40 max-lg:hidden"
        onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          resize.current = { startX: event.clientX, startWidth: width };
        }}
        onPointerMove={(event) => {
          if (resize.current) resizeTo(resize.current.startWidth + event.clientX - resize.current.startX);
        }}
        onPointerUp={() => {
          if (!resize.current) return;
          resize.current = null;
          saveWidth(width);
        }}
        onPointerCancel={() => (resize.current = null)}
        onDoubleClick={() => saveWidth(resizeTo(DEFAULT_WIDTH))}
        onKeyDown={handleResizeKey}
      />
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <h2 id={titleId} className="flex flex-1 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
        {onCollapse && <PanelToggle side="left" expanded label="the Mermaid code" onClick={onCollapse} />}
      </div>
      <label htmlFor={fieldId} className="sr-only">
        Mermaid code for {view.name}
      </label>
      {/* Line numbers in a gutter that scrolls with the code (lines don't wrap, so one number a line). */}
      <div className="flex min-h-0 flex-1">
        <div
          ref={gutterRef}
          aria-hidden
          className="shrink-0 select-none overflow-hidden border-r border-zinc-100 bg-zinc-50 py-3 pb-8 pl-3 pr-2 text-right font-mono text-[13px] leading-relaxed tabular-nums text-zinc-400 dark:border-zinc-900 dark:bg-zinc-900/40 dark:text-zinc-600"
        >
          {Array.from({ length: lineCount }, (_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>
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
          onScroll={(event) => {
            if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
          }}
          className="min-h-0 min-w-0 flex-1 resize-none overflow-auto whitespace-pre bg-transparent py-3 pl-2 pr-3 font-mono text-[13px] leading-relaxed text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40 dark:text-zinc-200"
        />
      </div>
      {/* Open by itself on a tab that had nothing in it when opened, where it's needed most; then it's up to you. */}
      <details
        open={cheatOpen}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          if (open !== cheatOpen) setCheatSheet((current) => ({ ...current, [view.id]: open }));
        }}
        className="group border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
      >
        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
          <Icon name="chevronDown" className="h-3 w-3 -rotate-90 transition-transform group-open:rotate-0" />
          Mermaid cheat sheet
        </summary>
        <dl className="mt-2 grid max-h-48 grid-cols-[auto_1fr] gap-x-3 gap-y-1 overflow-y-auto">
          {SYNTAX.map(([example, meaning]) => (
            <div key={example} className="contents">
              <dt>
                <code className="whitespace-nowrap rounded bg-zinc-100 px-1 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {example}
                </code>
              </dt>
              <dd className="truncate" title={meaning}>{meaning}</dd>
            </div>
          ))}
        </dl>
      </details>
      <div id={`${fieldId}-help`} className="flex flex-col gap-2 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        {shownError && (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {shownError}
          </p>
        )}
        {limitNote && (
          <p className={limitCheck.over ? "text-amber-700 dark:text-amber-400" : undefined} aria-live="polite">
            {limitNote}
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
    </aside>
  );
}
