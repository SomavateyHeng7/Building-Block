"use client";

import { dismissToast, useToasts, type ToastKind } from "@/lib/toast";

const STYLES: Record<ToastKind, { bar: string; icon: string; path: string }> = {
  success: { bar: "border-emerald-500", icon: "text-emerald-600 dark:text-emerald-400", path: "M5 13l4 4L19 7" },
  error: { bar: "border-red-500", icon: "text-red-600 dark:text-red-400", path: "M12 8v5M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" },
  info: { bar: "border-blue-500", icon: "text-blue-600 dark:text-blue-400", path: "M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" },
};

/** Notifications stacked in the bottom-right corner; errors are announced to screen readers at once. */
export default function ToastViewport() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((item) => {
        const style = STYLES[item.kind];
        return (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex gap-3 rounded-lg border border-l-4 border-zinc-200 bg-white p-3 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900 ${style.bar}`}
          >
            <svg viewBox="0 0 24 24" className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={style.path} />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
              {item.details && (
                <ul className="mt-1 list-disc pl-4 text-xs text-zinc-600 dark:text-zinc-400">
                  {item.details.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              {item.action && (
                <button
                  type="button"
                  className="mt-1.5 text-xs font-medium text-blue-600 underline dark:text-blue-400"
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
              aria-label="Dismiss"
              className="h-5 shrink-0 rounded px-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              onClick={() => dismissToast(item.id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
