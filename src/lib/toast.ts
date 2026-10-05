import { useSyncExternalStore } from "react";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  /** Extra lines, e.g. the repairs made while importing a file. */
  details?: string[];
  action?: { label: string; onClick: () => void };
}

interface ToastOptions {
  details?: string[];
  action?: Toast["action"];
  /** Milliseconds before it hides itself; 0 keeps it until dismissed. */
  duration?: number;
}

const DEFAULT_DURATION: Record<ToastKind, number> = { success: 4000, info: 5000, error: 8000 };

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
  // Keep the stack short: the oldest goes when a fourth arrives.
  emit([...toasts, { id, kind, title, details: options.details, action: options.action }].slice(-3));
  const duration = options.duration ?? (options.details?.length ? 12000 : DEFAULT_DURATION[kind]);
  if (duration > 0 && typeof window !== "undefined") window.setTimeout(() => dismissToast(id), duration);
  return id;
}

export const toast = {
  success: (title: string, options?: ToastOptions) => show("success", title, options),
  error: (title: string, options?: ToastOptions) => show("error", title, options),
  info: (title: string, options?: ToastOptions) => show("info", title, options),
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
}
