"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { create } from "zustand";
import { getActiveSection, useDiagramStore } from "@/lib/diagram/store";
import { applySequenceCode, mermaidIdAtLine, mermaidLineOf, readSequenceCode, toMermaidSequence } from "@/lib/diagram/exportMermaid";
import { ImportError, tokenizeMermaidLine, type CodeToken } from "@/lib/diagram/importMermaid";
import { downloadBlob, fileBaseName } from "@/lib/diagram/file";
import { checkSequenceCodeLines, limitNotice } from "@/lib/plans";
import { toast } from "@/lib/toast";
import { Icon } from "./Icon";
import PanelToggle from "./PanelToggle";
import { useReadOnly } from "./viewMode";
import { selectSequenceItem, useSequenceSelection } from "./sequenceSelection";

/** How long typing pauses before the sheet follows, like Mermaid's live editor. */
const LIVE_DELAY = 300;

const TOKEN_CLASS: Record<CodeToken["kind"], string> = {
  keyword: "font-semibold text-violet-700 dark:text-violet-400",
  name: "text-teal-700 dark:text-teal-400",
  arrow: "font-semibold text-blue-700 dark:text-blue-400",
  text: "text-zinc-800 dark:text-zinc-200",
  protocol: "text-amber-700 dark:text-amber-400",
  comment: "italic text-zinc-400 dark:text-zinc-500",
  plain: "",
  unknown: "text-red-700 underline decoration-red-500 decoration-wavy underline-offset-4 dark:text-red-400",
};

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
  ["Shop->>+Api: Get orders", "+ starts Api's activation bar"],
  ["Api-->>-Shop: Orders", "- ends it"],
  ["Note over Shop: Retries twice", "A note"],
  ["Shop->>Api: Get orders (REST)", "Protocol in brackets"],
  ["loop Every minute … end", "Repeated steps"],
  ["alt Paid … else Failed … end", "Alternatives"],
  ["opt / par … and / critical / break", "Optional, parallel, must-succeed, stop"],
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
  const highlightRef = useRef<HTMLPreElement>(null);
  const liveTimer = useRef<number | undefined>(undefined);
  /** What the last applied code said needed fixing or looked like a typo, shown under the code. */
  const [warnings, setWarnings] = useState<{ tab: string; items: string[] } | null>(null);
  const selectedId = useSequenceSelection((state) => state.id);
  const [focused, setFocused] = useState(false);
  /** Per tab, the sheet's code when the draft was last drawn: if the sheet changes after that, the draft is stale. */
  const [bases, setBases] = useState<Record<string, string>>({});
  useEffect(() => () => window.clearTimeout(liveTimer.current), []);

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
  const shownWarnings = warnings?.tab === view.id ? warnings.items : [];
  // The line of what's selected on the sheet, while the code says what the sheet shows.
  const selectedLine = selectedId && code === generated ? mermaidLineOf(sequence, selectedId) : undefined;
  const tokens = useMemo(() => code.split("\n").map(tokenizeMermaidLine), [code]);

  // The sheet changed while unreadable lines were waiting to be fixed: follow the sheet, and keep those lines at
  // the end so nothing typed is lost (and so drawing the code later can't undo what was done on the sheet).
  const base = bases[view.id];
  if (draft !== undefined && !focused && base !== undefined && base !== generated) {
    const unreadable = code.split("\n").filter((line) => tokenizeMermaidLine(line).some((token) => token.kind === "unknown"));
    setDraft(unreadable.length ? `${generated}${unreadable.join("\n")}\n` : undefined);
    setBases((current) => ({ ...current, [view.id]: generated }));
  }

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

  /**
   * Draws what the code says on the sheet. Typing a burst is one undo step (one coalesce key per tab); code that
   * can't be read leaves the sheet as it was and says why. Returns whether it applied.
   */
  function apply(text = code): boolean {
    window.clearTimeout(liveTimer.current);
    if (readOnly) return false;
    if (text === generated) {
      setError(null);
      return true;
    }
    // The plan's line limit; it only refuses once limits are enforced (see LIMITS_ENFORCED).
    const limit = checkSequenceCodeLines(text);
    if (limit.blocked) {
      setError({ tab: view.id, message: `The Free plan allows ${limit.limit} lines of code in a sequence tab; this has ${limit.used}.` });
      return false;
    }
    try {
      const parsed = readSequenceCode(text);
      updateSequence((current) => applySequenceCode(current, parsed), `code:${view.id}`);
      setBases((current) => ({ ...current, [view.id]: toMermaidSequence(applySequenceCode(sequence, parsed)) }));
      setError(null);
      setWarnings({ tab: view.id, items: parsed.fixes });
      return true;
    } catch (caught) {
      if (!(caught instanceof ImportError)) throw caught;
      setError({ tab: view.id, message: caught.message });
      return false;
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      apply();
    }
    // Tab indents (two spaces, as the code is written) instead of leaving the field; Esc then Tab still leaves.
    if (event.key === "Tab" && !event.shiftKey && !readOnly) {
      event.preventDefault();
      const field = event.currentTarget;
      const { selectionStart, selectionEnd } = field;
      const next = `${field.value.slice(0, selectionStart)}  ${field.value.slice(selectionEnd)}`;
      setDraft(next);
      scheduleApply(next);
      requestAnimationFrame(() => field.setSelectionRange(selectionStart + 2, selectionStart + 2));
    }
  }

  function scheduleApply(text: string) {
    window.clearTimeout(liveTimer.current);
    liveTimer.current = window.setTimeout(() => apply(text), LIVE_DELAY);
  }

  /** The cursor's line picks out what's written there on the sheet. */
  function selectFromCursor(field: HTMLTextAreaElement) {
    if (field.value !== generated) return;
    const line = field.value.slice(0, field.selectionStart).split("\n").length - 1;
    const id = mermaidIdAtLine(sequence, line);
    if (id && id !== useSequenceSelection.getState().id) selectSequenceItem(id);
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
            <div key={index} className={tokens[index]?.some((token) => token.kind === "unknown") ? "font-semibold text-red-500" : undefined}>
              {index + 1}
            </div>
          ))}
        </div>
        {/* The code coloured as Mermaid's editor does, under a field whose own text is see-through. */}
        <div className="relative min-h-0 min-w-0 flex-1">
        <pre
          ref={highlightRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre py-3 pl-2 pr-3 font-mono text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-200"
        >
          {tokens.map((line, index) => (
            <div key={index} className={index === selectedLine ? "-ml-2 bg-blue-100 pl-2 dark:bg-blue-950/60" : undefined}>
              {line.length ? line.map((token, at) => (
                <span key={at} className={TOKEN_CLASS[token.kind]}>
                  {token.text}
                </span>
              )) : "\u200b"}
            </div>
          ))}
          {/* Room to scroll the last line clear of the bottom, as the field has. */}
          <div className="h-8" />
        </pre>
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
            scheduleApply(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          onSelect={(event) => selectFromCursor(event.currentTarget)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            // Leaving the code: what's readable is drawn now. The code then follows the sheet again, unless it has
            // lines that couldn't be read: those stay (in red) to be fixed, rather than vanishing.
            const unreadable = tokens.some((line) => line.some((token) => token.kind === "unknown"));
            if ((!dirty || apply()) && !unreadable) {
              setDraft(undefined);
              setWarnings(null);
            }
          }}
          onScroll={(event) => {
            if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
            if (highlightRef.current) {
              highlightRef.current.scrollTop = event.currentTarget.scrollTop;
              highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
          className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent py-3 pb-8 pl-2 pr-3 font-mono text-[13px] leading-relaxed text-transparent caret-zinc-900 outline-none selection:bg-blue-200/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40 dark:caret-zinc-100 dark:selection:bg-blue-800/50"
        />
        </div>
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
            {shownError} The sheet shows the last code that worked.
          </p>
        )}
        {!shownError && shownWarnings.length > 0 && (
          <ul className="list-disc pl-4 text-amber-700 dark:text-amber-400" aria-live="polite">
            {shownWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
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
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className={`h-2 w-2 rounded-full ${shownError ? "bg-red-500" : "bg-emerald-500"}`} />
              {shownError ? "Not drawn yet: fix the line in red" : "Live: the sheet follows as you type, and the code follows the sheet."}
            </span>
            {shownError && (
              <button type="button" className={BUTTON} onClick={() => (setDraft(undefined), setError(null), setWarnings(null))}>
                Back to what the sheet shows
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
