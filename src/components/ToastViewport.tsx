"use client";

import { useEffect, useRef } from "react";
import { dismissToast, useToasts, type Toast, type ToastKind } from "@/lib/toast";

const KINDS: Record<ToastKind, { label: string; accent: string; icon: string; path: string }> = {
  success: {
    label: "Success",
    accent: "before:bg-emerald-500",
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    path: "M5 13l4 4L19 7",
  },
  info: {
    label: "Information",
    accent: "before:bg-blue-500",
    icon: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    path: "M12 16v-4M12 8h.01",
  },
  warning: {
    label: "Warning",
    accent: "before:bg-amber-500",
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    path: "M12 9v4M12 17h.01",
  },
  error: {
    label: "Error",
    accent: "before:bg-red-500",
    icon: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
    path: "M15 9l-6 6M9 9l6 6",
  },
};

/** Lists longer than this fold away behind "Show details". */
const DETAILS_SHOWN = 2;

/** One toast. Its timer pauses while it's hovered or has focus, so there's time to read it. */
function ToastCard({ item }: { item: Toast }) {
  const kind = KINDS[item.kind];
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  function start() {
    if (!item.duration || timer.current !== undefined) return;
    startedAt.current = Date.now();
    timer.current = window.setTimeout(() => dismissToast(item.id), remaining.current);
  }

  function pause() {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current));
  }

  useEffect(() => {
    start();
    return pause;
    // The timer belongs to this toast for its whole life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = item.details?.slice(0, DETAILS_SHOWN) ?? [];
  const folded = item.details?.slice(DETAILS_SHOWN) ?? [];

  return (
    <div
      role={item.kind === "error" ? "alert" : "status"}
      aria-label={kind.label}
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) start();
      }}
      className={`bb-toast pointer-events-auto relative flex gap-3 overflow-hidden rounded-xl border border-zinc-200 bg-white py-3 pl-4 pr-2 text-sm shadow-lg ring-1 ring-black/5 before:absolute before:inset-y-0 before:left-0 before:w-1 dark:border-zinc-700 dark:bg-zinc-900 ${kind.accent}`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${kind.icon}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={kind.path} />
        </svg>
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="break-words font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
        {item.description && <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{item.description}</p>}
        {shown.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-xs text-zinc-600 dark:text-zinc-400">
            {shown.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        )}
        {folded.length > 0 && (
          <details className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            <summary className="cursor-pointer font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100">
              Show {folded.length} more
            </summary>
            <ul className="mt-1 list-disc pl-4">
              {folded.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </details>
        )}
        {item.action && (
          <button
            type="button"
            className="mt-2 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              item.action!.onClick();
              dismissToast(item.id);
            }}
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        title="Dismiss"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        onClick={() => dismissToast(item.id)}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Notifications, newest at the bottom: bottom-right on wide screens, full width at the bottom on phones.
 * Errors are announced to screen readers at once, the rest politely.
 */
export default function ToastViewport() {
  const toasts = useToasts();
  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[300] flex flex-col gap-2 sm:left-auto sm:right-[max(1rem,env(safe-area-inset-right))] sm:w-96"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
