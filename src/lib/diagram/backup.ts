import { useSyncExternalStore } from "react";
import type { Diagram } from "./types";

/** When each diagram was last downloaded as a re-importable JSON file, by diagram id. */
type BackupTimes = Record<string, string>;

const BACKUPS_KEY = "bb:backups";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Safari deletes a site's storage after 7 days of use without a visit, so nudge before that much work is at risk. */
export const BACKUP_NUDGE_MS = 7 * DAY_MS;

export type BackupState = "current" | "stale" | "never";

function isBrowser() {
  return typeof window !== "undefined";
}

function readBackups(): BackupTimes {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(BACKUPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as BackupTimes) : {};
  } catch {
    return {};
  }
}

const listeners = new Set<() => void>();
let cachedBackups: BackupTimes = readBackups();

function writeBackups(next: BackupTimes) {
  try {
    window.localStorage.setItem(BACKUPS_KEY, JSON.stringify(next));
  } catch {
    // Not recording the time only means the editor keeps suggesting a backup.
  }
  cachedBackups = next;
  listeners.forEach((listener) => listener());
}

// Another tab exported or deleted a diagram.
if (isBrowser()) {
  window.addEventListener("storage", (event) => {
    if (event.key !== BACKUPS_KEY && event.key !== null) return;
    cachedBackups = readBackups();
    listeners.forEach((listener) => listener());
  });
}

export function markBackedUp(id: string, at = new Date().toISOString()): void {
  if (isBrowser()) writeBackups({ ...readBackups(), [id]: at });
}

export function forgetBackup(id: string): void {
  if (!isBrowser()) return;
  const next = readBackups();
  delete next[id];
  writeBackups(next);
}

export function getLastBackup(id: string): string | undefined {
  return cachedBackups[id];
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLastBackup(id: string): string | undefined {
  return useSyncExternalStore(subscribe, () => cachedBackups[id], () => undefined);
}

export function backupState(diagram: Diagram, lastBackup: string | undefined): BackupState {
  if (!lastBackup) return "never";
  return lastBackup >= diagram.updatedAt ? "current" : "stale";
}

export function hasContent(diagram: Diagram): boolean {
  return diagram.sections.some((section) => section.nodes.length > 0);
}

/** True when a diagram with content has gone a week or more without a backup that covers its latest changes. */
export function needsBackupNudge(diagram: Diagram, lastBackup: string | undefined, now = Date.now()): boolean {
  if (!hasContent(diagram) || backupState(diagram, lastBackup) === "current") return false;
  return now - Date.parse(lastBackup ?? diagram.createdAt) >= BACKUP_NUDGE_MS;
}

export function formatAge(iso: string, now = Date.now()): string {
  const days = Math.floor((now - Date.parse(iso)) / DAY_MS);
  if (days <= 0) return "today";
  return days === 1 ? "yesterday" : `${days} days ago`;
}

let persistRequested = false;

/**
 * Asks the browser not to evict this site's storage when the disk runs low.
 * Chrome and Edge decide silently; Firefox may ask the user once. Safari's 7-day rule may still apply.
 */
export async function requestPersistentStorage(): Promise<void> {
  if (persistRequested || !isBrowser() || !navigator.storage?.persist) return;
  persistRequested = true;
  try {
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // Unsupported or refused: diagrams are still saved, just without the eviction guarantee.
  }
}
