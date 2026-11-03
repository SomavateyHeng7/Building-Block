import { useSyncExternalStore } from "react";

/**
 * Which templates were started most recently, newest first. Only template ids are kept (a small preference,
 * like the theme): never a diagram's name or content. If storage is blocked, the list lasts until the tab closes.
 */

const KEY = "bb:recent-templates";
export const MAX_RECENT = 3;

const NONE: string[] = [];
let memory: string[] = NONE;
let cachedRaw: string | null | undefined;
let cached: string[] = NONE;
const listeners = new Set<() => void>();

function parse(raw: string | null): string[] {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!Array.isArray(value)) return NONE;
    const ids = value.filter((id): id is string => typeof id === "string").slice(0, MAX_RECENT);
    return ids.length ? ids : NONE;
  } catch {
    return NONE;
  }
}

/** The stored ids; the same array is returned until they change, so it's safe for useSyncExternalStore. */
export function readRecentTemplates(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return memory;
  }
  if (raw === null) return memory;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

export function recordRecentTemplate(id: string): void {
  const next = [id, ...readRecentTemplates().filter((existing) => existing !== id)].slice(0, MAX_RECENT);
  memory = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Kept in memory for this tab only.
  }
  listeners.forEach((listener) => listener());
}

export function clearRecentTemplates(): void {
  memory = NONE;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Recently started template ids, newest first; empty on the server and before the first read. */
export function useRecentTemplates(): string[] {
  return useSyncExternalStore(subscribe, readRecentTemplates, () => NONE);
}
