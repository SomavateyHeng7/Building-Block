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

/** `items` with the ones whose id is in `recentIds` first (in that order), then the rest in their usual order. */
export function recentFirst<T extends { id: string }>(items: T[], recentIds: string[]): T[] {
  const recent = recentIds.flatMap((id) => items.filter((item) => item.id === id));
  return [...recent, ...items.filter((item) => !recent.includes(item))];
}

/** Forgets ids that aren't templates any more (renamed or removed), so they don't take one of the three places. */
export function pruneRecentTemplates(validIds: Iterable<string>): void {
  const valid = new Set(validIds);
  const current = readRecentTemplates();
  const kept = current.filter((id) => valid.has(id));
  if (kept.length === current.length) return;
  if (kept.length === 0) clearRecentTemplates();
  else {
    memory = kept;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(kept));
    } catch {
      // Kept in memory for this tab only.
    }
    listeners.forEach((listener) => listener());
  }
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
