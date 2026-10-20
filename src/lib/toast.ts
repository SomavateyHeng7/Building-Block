import { useSyncExternalStore } from "react";

/**
 * Notifications. Every toast follows the same pattern, so they read as one voice:
 *
 * - **title**: what happened, in a few words, sentence case, no full stop.
 *   Success names the result ("Downloaded plan.png"); failure starts with "Couldn't" ("Couldn't save the file").
 * - **description** (optional): one sentence saying what to do next, or why.
 * - **details** (optional): a list, e.g. the repairs made to a file. Long lists fold away behind "Show details".
 * - **action** (optional): one button, for the obvious next step.
 *
 * Kinds: success (it worked), info (worth knowing, nothing went wrong), warning (it worked, but check
 * something), error (it didn't work). Errors stay until dismissed; the rest hide themselves, and pause
 * while hovered or focused so they can be read.
 */
export type ToastKind = "success" | "info" | "warning" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  details?: string[];
  action?: { label: string; onClick: () => void };
  /** Milliseconds before it hides itself; 0 keeps it until dismissed. */
  duration: number;
}

interface ToastOptions {
  description?: string;
  details?: string[];
  action?: Toast["action"];
  /** Milliseconds before it hides itself; 0 keeps it until dismissed. Defaults by kind. */
  duration?: number;
}

export const DEFAULT_DURATION: Record<ToastKind, number> = { success: 5000, info: 6000, warning: 10000, error: 0 };
/** Toasts on screen at once; the oldest goes when another arrives. */
const MAX_TOASTS = 3;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: Toast[] = [];

function emit(next: Toast[]) {
  toasts = next;
  listeners.forEach((listener) => listener());
}

export function dismissToast(id: number): void {
  emit(toasts.filter((toast) => toast.id !== id));
}

function show(kind: ToastKind, title: string, options: ToastOptions = {}): number {
  const id = nextId++;
  const toast: Toast = {
    id,
    kind,
    title,
    description: options.description,
    details: options.details?.length ? options.details : undefined,
    action: options.action,
    duration: options.duration ?? DEFAULT_DURATION[kind],
  };
  // The same message again replaces the old one instead of stacking up.
  const others = toasts.filter((existing) => !(existing.kind === kind && existing.title === title));
  emit([...others, toast].slice(-MAX_TOASTS));
  return id;
}

export const toast = {
  success: (title: string, options?: ToastOptions) => show("success", title, options),
  info: (title: string, options?: ToastOptions) => show("info", title, options),
  warning: (title: string, options?: ToastOptions) => show("warning", title, options),
  error: (title: string, options?: ToastOptions) => show("error", title, options),
};

/** Test helper: the toasts currently showing. */
export function currentToasts(): Toast[] {
  return toasts;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
}
