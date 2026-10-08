"use client";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Ctrl/⌘ + S", action: "Save to the open file (asks where the first time)" },
  { keys: "Ctrl/⌘ + Shift + S", action: "Save as a new file" },
  { keys: "B", action: "Add a component (inside the selected container)" },
  { keys: "C", action: "Add a container" },
  { keys: "Drag from a dot", action: "Connect a component to another (dots appear on hover, selection or touch)" },
  { keys: "Arrow keys", action: "Nudge the selection by 8 px (hold Shift for 32 px)" },
  { keys: "Delete / Backspace", action: "Delete the selection, including a selected connection" },
  { keys: "Esc", action: "Clear the selection" },
  { keys: "Ctrl/⌘ + A", action: "Select everything on this tab" },
  { keys: "Ctrl/⌘ + C / X / V", action: "Copy, cut, paste" },
  { keys: "Ctrl/⌘ + D", action: "Duplicate the selection" },
  { keys: "Ctrl/⌘ + Z", action: "Undo" },
  { keys: "Ctrl/⌘ + Shift + Z or Y", action: "Redo" },
  { keys: "?", action: "Show or hide this list" },
];

export default function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
          <button
            type="button"
            autoFocus
            aria-label="Close"
            className="rounded px-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <dl className="flex flex-col gap-2 text-sm">
          {SHORTCUTS.map((item) => (
            <div key={item.keys} className="flex items-start justify-between gap-4">
              <dd className="text-zinc-600 dark:text-zinc-400">{item.action}</dd>
              <dt className="shrink-0 rounded border border-zinc-300 px-1.5 py-0.5 font-mono text-xs dark:border-zinc-700">
                {item.keys}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
