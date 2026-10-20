import { useSyncExternalStore } from "react";
import type { Diagram } from "./types";
import { parseDiagram } from "./validate";

/**
 * Recovery copies (opt-in). Off by default: the app keeps no diagram in the browser. Turned on, the open
 * diagram's unsaved changes are kept in this browser's storage until they're saved to a file or
 * discarded, so a reload, crash or closed tab doesn't lose them. Useful most in Safari and Firefox, which
 * can't save back to a file. One slot: editing another diagram replaces the copy.
 */

const ENABLED_KEY = "bb:recovery:enabled";
const COPY_KEY = "bb:recovery:copy";

export interface RecoveryCopy {
  diagram: Diagram;
  /** The file it was last saved to or opened from, if any. */
  fileName: string | null;
  /** When the copy was written. */
  keptAt: string;
}

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeRecovery(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isRecoveryEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Turning it off also deletes any copy, so nothing is left behind. */
export function setRecoveryEnabled(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(ENABLED_KEY, "true");
    else {
      window.localStorage.removeItem(ENABLED_KEY);
      window.localStorage.removeItem(COPY_KEY);
    }
  } catch {
    // Storage is blocked: there's nowhere to keep a copy.
  }
  emit();
}

/** Keeps `diagram` as the recovery copy. False when recovery is off or the browser refused (e.g. full). */
export function writeRecoveryCopy(diagram: Diagram, fileName: string | null, now = new Date()): boolean {
  if (!isRecoveryEnabled()) return false;
  const copy: RecoveryCopy = { diagram, fileName, keptAt: now.toISOString() };
  try {
    window.localStorage.setItem(COPY_KEY, JSON.stringify(copy));
    emit();
    return true;
  } catch {
    return false;
  }
}

/** The kept copy, checked like any opened file. Null if there's none, or it can't be read. */
export function readRecoveryCopy(): RecoveryCopy | null {
  try {
    const raw = window.localStorage.getItem(COPY_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const { diagram } = parseDiagram(saved?.diagram);
    return {
      diagram,
      fileName: typeof saved.fileName === "string" ? saved.fileName : null,
      keptAt: typeof saved.keptAt === "string" ? saved.keptAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/** Removes the copy. With `diagramId`, only if the copy is of that diagram (another diagram's copy stays). */
export function clearRecoveryCopy(diagramId?: string): void {
  try {
    const raw = window.localStorage.getItem(COPY_KEY);
    if (!raw) return;
    if (diagramId !== undefined && JSON.parse(raw)?.diagram?.id !== diagramId) return;
    window.localStorage.removeItem(COPY_KEY);
  } catch {
    // Nothing stored, or storage is blocked.
  }
  emit();
}

export function useRecoveryEnabled(): boolean {
  return useSyncExternalStore(subscribeRecovery, isRecoveryEnabled, () => false);
}

let snapshot: { raw: string | null; copy: RecoveryCopy | null } = { raw: null, copy: null };

/** The copy, re-read only when storage changed, so React gets the same object back. */
function recoverySnapshot(): RecoveryCopy | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(COPY_KEY);
  } catch {
    // Storage is blocked.
  }
  if (raw !== snapshot.raw) snapshot = { raw, copy: raw ? readRecoveryCopy() : null };
  return snapshot.copy;
}

export function useRecoveryCopy(): RecoveryCopy | null {
  return useSyncExternalStore(subscribeRecovery, recoverySnapshot, () => null);
}
